<?php
header("Content-Type: application/json; charset=UTF-8");

error_reporting(0);
set_time_limit(60);

$CACHE_DIR = __DIR__ . "/cache";
$CACHE_TTL = 300;

$BR_JSON = __DIR__ . "/br_jobs.json";
$SALARY_JSON = __DIR__ . "/salary_data.json";

$USAJOBS_API_KEY = "s2UFDkDCBiW2cqBdpUkjvnq4th6PiRRaNvju/u7hGb8=";
$USAJOBS_USER_AGENT = "ingridcernauski@gmail.com";

$REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs";

$COUNTRIES = ["us","ca","gb","de","fr","es","it","nl","be","ch","at","pl"];

$q = trim($_GET["q"] ?? "");
$pais = strtolower(trim($_GET["pais"] ?? "all"));
$page = max(1, intval($_GET["page"] ?? 1));

$allowed = array_merge(["all", "br"], $COUNTRIES);

if (!in_array($pais, $allowed, true)) {
    echo json_encode([
        "results" => [],
        "error" => "País inválido."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!file_exists($CACHE_DIR)) {
    mkdir($CACHE_DIR, 0777, true);
}

$cacheKey = md5($q . "_" . $pais . "_" . $page);
$cacheFile = $CACHE_DIR . "/" . $cacheKey . ".json";

if (file_exists($cacheFile) && time() - filemtime($cacheFile) < $CACHE_TTL) {
    echo file_get_contents($cacheFile);
    exit;
}

$resultados = [];

if ($pais === "br") {
    $resultados = buscarBrasil($q, $BR_JSON);
} elseif ($pais === "us") {
    $resultados = array_merge(
        buscarUsaJobs($q ?: "analyst", $page, $USAJOBS_API_KEY, $USAJOBS_USER_AGENT),
        buscarRemotive($q ?: "analyst", "us", $REMOTIVE_API_URL)
    );
} elseif ($pais === "all") {
    $resultados = array_merge(
        buscarBrasil($q, $BR_JSON),
        buscarUsaJobs($q ?: "analyst", $page, $USAJOBS_API_KEY, $USAJOBS_USER_AGENT),
        buscarRemotive($q ?: "analyst", "all", $REMOTIVE_API_URL)
    );
} else {
    $resultados = buscarRemotive($q ?: "analyst", $pais, $REMOTIVE_API_URL);
}

$resultados = aplicarSalarioInteligente($resultados, $SALARY_JSON);
$resultados = deduplicar($resultados);

$response = json_encode([
    "results" => array_slice(array_values($resultados), 0, 300)
], JSON_UNESCAPED_UNICODE);

file_put_contents($cacheFile, $response);

echo $response;
exit;

/*
|--------------------------------------------------------------------------
| BRASIL
|--------------------------------------------------------------------------
*/
function buscarBrasil(string $query, string $file): array
{
    if (!file_exists($file)) return [];

    $raw = file_get_contents($file);
    if ($raw === false) return [];

    $json = json_decode($raw, true);
    if (!is_array($json)) return [];

    $query = mb_strtolower(trim($query));

    $normalized = array_map(function ($job) {
        $url = isset($job["url"]) && is_string($job["url"]) ? trim($job["url"]) : "";

        $title = $job["title"] ?? "";
        $description = $job["description"] ?? "";
        $location = $job["location"] ?? "Brasil";

        return [
            "id" => $job["id"] ?? uniqid("br_", true),
            "title" => $title,
            "company" => [
                "display_name" => $job["company"] ?? ""
            ],
            "location" => [
                "display_name" => $location
            ],
            "description" => $description,
            "redirect_url" => $url,
            "salary_min" => isset($job["salary_min"]) ? (float)$job["salary_min"] : 0,
            "salary_max" => isset($job["salary_max"]) ? (float)$job["salary_max"] : 0,
            "pais" => "br",
            "source_type" => "local_json",
            "source_name" => "Brasil JSON",
            "modalidade" => detectarModalidade($title . " " . $description . " " . $location),
            "area" => detectarArea($title . " " . $description)
        ];
    }, $json);

    $normalized = array_values(array_filter($normalized, function ($job) {
        $salaryMin = (float)($job["salary_min"] ?? 0);
        $salaryMax = (float)($job["salary_max"] ?? 0);
        $salario = max($salaryMin, $salaryMax);

        return $salario >= 3000;
    }));

    if ($query === "") {
        return $normalized;
    }

    $termos = array_values(array_filter(explode(" ", $query), fn($t) => trim($t) !== ""));

    $scoreados = [];

    foreach ($normalized as $job) {
        $texto = mb_strtolower(
            ($job["title"] ?? "") . " " .
            ($job["company"]["display_name"] ?? "") . " " .
            ($job["location"]["display_name"] ?? "") . " " .
            ($job["description"] ?? "") . " " .
            ($job["area"] ?? "") . " " .
            ($job["modalidade"] ?? "")
        );

        $score = 0;

        if ($query !== "" && str_contains($texto, $query)) {
            $score += 10;
        }

        foreach ($termos as $termo) {
            $termo = trim($termo);
            if ($termo !== "" && str_contains($texto, $termo)) {
                $score += 3;
            }
        }

        $sinonimos = [
            "developer" => ["desenvolvedor", "tecnologia", "backend", "frontend", "full stack"],
            "data" => ["dados", "bi", "power bi", "sql", "analytics"],
            "analyst" => ["analista", "dados", "bi", "financeiro", "marketing"],
            "marketing" => ["marketing", "mídia", "midia", "growth", "crm", "performance"],
            "media" => ["mídia", "midia", "performance", "marketing"],
            "finance" => ["financeiro", "finanças", "controladoria"],
            "product" => ["produto", "product manager", "pm"],
            "project" => ["projetos", "gerente de projetos", "project manager"]
        ];

        foreach ($sinonimos as $key => $lista) {
            if (str_contains($query, $key)) {
                foreach ($lista as $s) {
                    if (str_contains($texto, $s)) {
                        $score += 2;
                    }
                }
            }
        }

        if ($score > 0) {
            $job["_score"] = $score;
            $scoreados[] = $job;
        }
    }

    usort($scoreados, function ($a, $b) {
        return ($b["_score"] ?? 0) <=> ($a["_score"] ?? 0);
    });

    if (count($scoreados) >= 20) {
        return array_map(fn($j) => removerScore($j), $scoreados);
    }

    $ids = array_column($scoreados, "id");
    $complemento = array_values(array_filter($normalized, fn($j) => !in_array($j["id"], $ids)));

    return array_map(fn($j) => removerScore($j), array_merge($scoreados, $complemento));
}

function removerScore(array $job): array
{
    unset($job["_score"]);
    return $job;
}

function detectarModalidade(string $texto): string
{
    $texto = mb_strtolower($texto);

    if (str_contains($texto, "híbrido") || str_contains($texto, "hibrido") || str_contains($texto, "hybrid")) {
        return "Híbrido";
    }

    if (str_contains($texto, "remoto") || str_contains($texto, "remote") || str_contains($texto, "home office")) {
        return "Remoto";
    }

    return "Presencial";
}

function detectarArea(string $texto): string
{
    $texto = mb_strtolower($texto);

    if (
        str_contains($texto, "dados") ||
        str_contains($texto, "data") ||
        str_contains($texto, "bi") ||
        str_contains($texto, "power bi") ||
        str_contains($texto, "sql") ||
        str_contains($texto, "analytics")
    ) {
        return "Dados / BI";
    }

    if (
        str_contains($texto, "mídia") ||
        str_contains($texto, "midia") ||
        str_contains($texto, "performance")
    ) {
        return "Mídia";
    }

    if (
        str_contains($texto, "marketing") ||
        str_contains($texto, "growth") ||
        str_contains($texto, "crm")
    ) {
        return "Marketing";
    }

    if (
        str_contains($texto, "desenvolvedor") ||
        str_contains($texto, "developer") ||
        str_contains($texto, "backend") ||
        str_contains($texto, "frontend") ||
        str_contains($texto, "full stack") ||
        str_contains($texto, "engenheiro de software")
    ) {
        return "Tecnologia";
    }

    if (
        str_contains($texto, "financeiro") ||
        str_contains($texto, "finanças") ||
        str_contains($texto, "controladoria")
    ) {
        return "Financeiro";
    }

    if (
        str_contains($texto, "produto") ||
        str_contains($texto, "product")
    ) {
        return "Produto";
    }

    if (
        str_contains($texto, "rh") ||
        str_contains($texto, "recrutamento") ||
        str_contains($texto, "people")
    ) {
        return "RH";
    }

    if (
        str_contains($texto, "projeto") ||
        str_contains($texto, "project") ||
        str_contains($texto, "pm")
    ) {
        return "Projetos";
    }

    if (str_contains($texto, "analista")) {
        return "Analista";
    }

    return "Analista";
}

/*
|--------------------------------------------------------------------------
| USAJOBS
|--------------------------------------------------------------------------
*/
function buscarUsaJobs(string $query, int $page, string $apiKey, string $userAgent): array
{
    $params = [
        "Keyword" => $query,
        "Page" => $page,
        "ResultsPerPage" => 25
    ];

    $url = "https://data.usajobs.gov/api/search?" . http_build_query($params);

    $headers = [
        "Host: data.usajobs.gov",
        "User-Agent: " . $userAgent,
        "Authorization-Key: " . $apiKey,
        "Accept: application/json"
    ];

    $res = httpGet($url, 20, $headers);
    if ($res === null || $res === "") return [];

    $data = json_decode($res, true);
    if (!is_array($data)) return [];

    $items = $data["SearchResult"]["SearchResultItems"] ?? [];
    if (!is_array($items)) return [];

    return array_map(function ($item) {
        $d = $item["MatchedObjectDescriptor"] ?? [];

        $applyUri = "";
        if (!empty($d["ApplyURI"]) && is_array($d["ApplyURI"]) && !empty($d["ApplyURI"][0])) {
            $applyUri = trim((string)$d["ApplyURI"][0]);
        }

        $positionUri = "";
        if (!empty($d["PositionURI"]) && is_string($d["PositionURI"])) {
            $positionUri = trim($d["PositionURI"]);
        }

        $payMin = 0;
        $payMax = 0;

        if (!empty($d["PositionRemuneration"]) && is_array($d["PositionRemuneration"])) {
            $rem = $d["PositionRemuneration"][0] ?? [];
            $payMin = isset($rem["MinimumRange"]) ? (float)$rem["MinimumRange"] : 0;
            $payMax = isset($rem["MaximumRange"]) ? (float)$rem["MaximumRange"] : 0;
        }

        return [
            "id" => $item["MatchedObjectId"] ?? uniqid("us_", true),
            "title" => $d["PositionTitle"] ?? "",
            "company" => [
                "display_name" => $d["OrganizationName"] ?? "USAJOBS"
            ],
            "location" => [
                "display_name" => $d["PositionLocationDisplay"] ?? "United States"
            ],
            "description" => $d["QualificationSummary"] ?? "",
            "redirect_url" => $applyUri !== "" ? $applyUri : $positionUri,
            "salary_min" => $payMin,
            "salary_max" => $payMax,
            "pais" => "us",
            "source_type" => "api",
            "source_name" => "USAJOBS",
            "modalidade" => "Presencial",
            "area" => detectarArea($d["PositionTitle"] ?? "")
        ];
    }, $items);
}

/*
|--------------------------------------------------------------------------
| REMOTIVE
|--------------------------------------------------------------------------
*/
function buscarRemotive(string $query, string $pais, string $apiUrl): array
{
    $url = $apiUrl . "?search=" . urlencode($query);

    $res = httpGet($url, 15, ["Accept: application/json"]);
    if ($res === null || $res === "") return [];

    $data = json_decode($res, true);
    if (!is_array($data)) return [];

    $items = $data["jobs"] ?? [];
    if (!is_array($items)) return [];

    $mapped = array_map(function ($job) {
        $salaryMin = 0;
        $salaryMax = 0;

        if (!empty($job["salary"])) {
            $salary = (string)$job["salary"];
            if (preg_match('/([\d,\.]+).*?([\d,\.]+)/', $salary, $m)) {
                $salaryMin = (float)preg_replace('/[^\d\.]/', "", $m[1]);
                $salaryMax = (float)preg_replace('/[^\d\.]/', "", $m[2]);
            }
        }

        $country = normalizarPaisRemotive($job);
        $description = strip_tags($job["description"] ?? "");

        return [
            "id" => $job["id"] ?? uniqid("remotive_", true),
            "title" => $job["title"] ?? "",
            "company" => [
                "display_name" => $job["company_name"] ?? "Remotive"
            ],
            "location" => [
                "display_name" => $job["candidate_required_location"] ?? "Remote"
            ],
            "description" => $description,
            "redirect_url" => $job["url"] ?? "",
            "salary_min" => $salaryMin,
            "salary_max" => $salaryMax,
            "pais" => $country,
            "source_type" => "api",
            "source_name" => "Remotive",
            "modalidade" => "Remoto",
            "area" => detectarArea(($job["title"] ?? "") . " " . $description)
        ];
    }, $items);

    if ($pais === "all") return $mapped;

    return array_values(array_filter($mapped, fn($job) => $job["pais"] === $pais));
}

function normalizarPaisRemotive(array $job): string
{
    $loc = mb_strtolower($job["candidate_required_location"] ?? "");

    if (str_contains($loc, "brazil")) return "br";
    if (str_contains($loc, "usa") || str_contains($loc, "united states")) return "us";
    if (str_contains($loc, "canada")) return "ca";
    if (str_contains($loc, "united kingdom") || str_contains($loc, "uk")) return "gb";
    if (str_contains($loc, "germany")) return "de";
    if (str_contains($loc, "france")) return "fr";
    if (str_contains($loc, "spain")) return "es";
    if (str_contains($loc, "italy")) return "it";
    if (str_contains($loc, "netherlands")) return "nl";
    if (str_contains($loc, "belgium")) return "be";
    if (str_contains($loc, "switzerland")) return "ch";
    if (str_contains($loc, "austria")) return "at";
    if (str_contains($loc, "poland")) return "pl";

    return "us";
}

/*
|--------------------------------------------------------------------------
| SALÁRIO
|--------------------------------------------------------------------------
*/
function aplicarSalarioInteligente(array $jobs, string $salaryFile): array
{
    $salaryData = file_exists($salaryFile)
        ? json_decode(file_get_contents($salaryFile), true)
        : [];

    if (!is_array($salaryData)) return $jobs;

    foreach ($jobs as &$job) {
        $salaryMin = (float)($job["salary_min"] ?? 0);
        $salaryMax = (float)($job["salary_max"] ?? 0);

        if ($salaryMin > 0 || $salaryMax > 0) {
            $job["salary_type"] = "real";
            continue;
        }

        $titulo = mb_strtolower($job["title"] ?? "");

        foreach ($salaryData as $cargo => $valores) {
            if (!is_array($valores)) continue;

            if (str_contains($titulo, mb_strtolower($cargo))) {
                $media = calcularMedia($valores);
                if ($media > 0) {
                    $job["salary_estimated"] = $media;
                    $job["salary_type"] = "estimado";
                }
                break;
            }
        }
    }

    unset($job);
    return $jobs;
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/
function httpGet(string $url, int $timeout = 10, array $headers = []): ?string
{
    if (function_exists("curl_init")) {
        $ch = curl_init();

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER => $headers
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($response === false || $httpCode >= 400) return null;

        return $response;
    }

    $context = stream_context_create([
        "http" => [
            "timeout" => $timeout,
            "ignore_errors" => true,
            "header" => implode("\r\n", $headers)
        ]
    ]);

    $response = @file_get_contents($url, false, $context);

    return $response === false ? null : $response;
}

function deduplicar(array $jobs): array
{
    $seen = [];
    $out = [];

    foreach ($jobs as $j) {
        $id = $j["id"] ?? null;

        if (!$id) {
            $id = md5(
                ($j["title"] ?? "") . "|" .
                ($j["company"]["display_name"] ?? "") . "|" .
                ($j["location"]["display_name"] ?? "")
            );
        }

        if (!isset($seen[$id])) {
            $seen[$id] = true;
            $out[] = $j;
        }
    }

    return $out;
}

function calcularMedia(array $lista): float
{
    $numeros = array_filter($lista, fn($v) => is_numeric($v));
    if (count($numeros) === 0) return 0;
    return array_sum($numeros) / count($numeros);
}