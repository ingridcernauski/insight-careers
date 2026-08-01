   let vagasFavoritas = JSON.parse(localStorage.getItem("favoritas")) || [];
    let paginaAtual = 1;
    const vagasPorPagina = 18;
    let listaFiltradaAtual = [];
    let vagas = [];
    let abaAtual = "todas";

    let modalidadesSelecionadas = [];
    let areasSelecionadas = [];

    const buscaEl = document.getElementById("busca");
    const paisEl = document.getElementById("pais");
    const estadoEl = document.getElementById("estado");
    const cidadeEl = document.getElementById("cidade");
    const faixaEl = document.getElementById("faixaSalario");
    const toastEl = document.getElementById("toast");
    const btnExportarSalvas = document.getElementById("btnExportarSalvas");
    const btnLimparSalvas = document.getElementById("btnLimparSalvas");
    const statusEl = document.getElementById("status");

    const CACHE_TTL_MS = 1000 * 60 * 10;

    function mostrarToast(texto){
      toastEl.textContent = texto;
      toastEl.classList.add("show");
      clearTimeout(window.toastTimeout);
      window.toastTimeout = setTimeout(() => toastEl.classList.remove("show"), 2500);
    }

    function setStatus(texto){ statusEl.textContent = texto; }
    function salvarFavoritas(){ localStorage.setItem("favoritas", JSON.stringify(vagasFavoritas)); }
    function atualizarTotalFavoritas(){ document.getElementById("totalFavoritas").textContent = vagasFavoritas.length; }

    function atualizarAcoesSalvas(){
      const mostrar = abaAtual === "salvas";
      btnExportarSalvas.style.display = mostrar ? "inline-flex" : "none";
      btnLimparSalvas.style.display = mostrar ? "inline-flex" : "none";
    }

    function normalizarTexto(valor, fallback = "Não informado"){
      if (valor === null || valor === undefined || valor === "") return fallback;
      return String(valor);
    }

    function escaparHtml(texto){
      return String(texto)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function countryCodeParaNome(code){
      const mapa = {
        br:"Brasil", us:"Estados Unidos", ca:"Canadá", gb:"Reino Unido", de:"Alemanha",
        fr:"França", es:"Espanha", it:"Itália", nl:"Holanda", be:"Bélgica", ch:"Suíça",
        at:"Áustria", pl:"Polônia"
      };
      return mapa[code?.toLowerCase()] || code || "Internacional";
    }

    function countryCodeParaBandeira(code){
      const mapa = {
        br:"🇧🇷", us:"🇺🇸", ca:"🇨🇦", gb:"🇬🇧", de:"🇩🇪", fr:"🇫🇷", es:"🇪🇸",
        it:"🇮🇹", nl:"🇳🇱", be:"🇧🇪", ch:"🇨🇭", at:"🇦🇹", pl:"🇵🇱"
      };
      return mapa[code?.toLowerCase()] || "🌍";
    }

    function countryCodeParaMoeda(code){
      const mapa = {
        br:"BRL", us:"USD", ca:"CAD", gb:"GBP", de:"EUR", fr:"EUR", es:"EUR", it:"EUR",
        nl:"EUR", be:"EUR", at:"EUR", pl:"PLN", ch:"CHF"
      };
      return mapa[code?.toLowerCase()] || "USD";
    }

    function formatarMoeda(valor){
      if (!valor || Number.isNaN(Number(valor))) return "Salário a combinar";
      return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }

    function formatarMoedaPorCodigo(valor, currencyCode){
      if (!valor || Number.isNaN(Number(valor))) return "Salário a combinar";
      const localeMap = {
        BRL:"pt-BR", USD:"en-US", CAD:"en-CA", GBP:"en-GB", EUR:"de-DE", PLN:"pl-PL", CHF:"de-CH"
      };
      return Number(valor).toLocaleString(localeMap[currencyCode] || "en-US", {
        style:"currency",
        currency:currencyCode
      });
    }

    function converterParaBRL(valor, currencyCode){
      const fx = { BRL:1, USD:5.00, CAD:3.70, GBP:6.40, EUR:5.45, PLN:1.27, CHF:5.70 };
      if (!valor || Number.isNaN(Number(valor))) return null;
      return Number(valor) * (fx[currencyCode] || 1);
    }

    function valorBaseSalario(vaga){
      if (vaga.salario && vaga.salario > 0) return vaga.salario;
      if (vaga.salaryEstimated && vaga.salaryEstimated > 0) return vaga.salaryEstimated;
      return 0;
    }

    function formatarSalarioCompleto(vaga){
      const base = valorBaseSalario(vaga);
      if (!base) return "Salário a combinar";

      if (vaga.salaryType === "estimado") {
        return `Estimado: ${formatarMoeda(base)}`;
      }

      const local = formatarMoedaPorCodigo(base, vaga.currency || "USD");
      const brl = converterParaBRL(base, vaga.currency || "USD");
      if (!brl || vaga.currency === "BRL") return local;
      return `${local} • ${formatarMoeda(brl)}`;
    }

    function termoPadraoPorPais(pais){
      return pais === "br" ? "analista" : "developer";
    }

    function mapearModalidade(titulo = "", descricao = "", cidade = ""){
      const texto = `${titulo} ${descricao} ${cidade}`.toLowerCase();
      if (texto.includes("híbrido") || texto.includes("hybrid")) return "Híbrido";
      if (texto.includes("remoto") || texto.includes("remote")) return "Remoto";
      if (texto.includes("home office")) return "Remoto";
      return "Presencial";
    }

    function mapearArea(titulo = "", descricao = ""){
      const texto = `${titulo} ${descricao}`.toLowerCase();
      if (texto.includes("analista")) return "Analista";
      if (texto.includes("mídia") || texto.includes("midia")) return "Mídia";
      if (texto.includes("marketing") || texto.includes("growth") || texto.includes("crm")) return "Marketing";
      if (texto.includes("dados") || texto.includes("data") || texto.includes("bi") || texto.includes("power bi") || texto.includes("sql")) return "Dados / BI";
      if (texto.includes("desenvolvedor") || texto.includes("developer") || texto.includes("frontend") || texto.includes("backend") || texto.includes("full stack") || texto.includes("engenheiro de software")) return "Tecnologia";
      if (texto.includes("financeiro") || texto.includes("finanças") || texto.includes("contábil") || texto.includes("controladoria")) return "Financeiro";
      if (texto.includes("produto") || texto.includes("product")) return "Produto";
      if (texto.includes("rh") || texto.includes("recrutamento") || texto.includes("people")) return "RH";
      if (texto.includes("projeto") || texto.includes("project") || texto.includes("pm") || texto.includes("gerente de projetos")) return "Projetos";
      return "Analista";
    }

    function getCacheKey(termo, pais, page){
      return `jobs_cache::${pais || "all"}::${termo || "default"}::${page}`;
    }

    function getCachedJobs(key){
      try{
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.timestamp || !Array.isArray(parsed?.results)) return null;
        if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null;
        return parsed.results;
      } catch {
        return null;
      }
    }

    function setCachedJobs(key, results){
      try{
        localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), results }));
      } catch {}
    }

    async function carregarVagas(){

      const response = await fetch("br_jobs.json");

      if(!response.ok){
        throw new Error("Erro ao carregar br_jobs.json");
      }

    function renderizarSkeleton(qtd = 6){
      const listaEl = document.getElementById("listaVagas");
      const resultsEl = document.querySelector(".results");
      resultsEl.classList.add("loading");
      listaEl.innerHTML = "";
      document.getElementById("mensagemVazia").style.display = "none";
      document.getElementById("paginacao").innerHTML = "";

      for(let i = 0; i < qtd; i++){
        const card = document.createElement("article");
        card.className = "skeleton-card skeleton";
        card.innerHTML = `
          <div class="skeleton-line sm"></div>
          <div class="skeleton-line lg"></div>
          <div class="skeleton-line md"></div>
          <div class="skeleton-salary"></div>
          <div class="skeleton-line full"></div>
          <div class="skeleton-line lg"></div>
          <div class="skeleton-line full"></div>
        `;
        listaEl.appendChild(card);
      }
    }

    function esconderSkeleton(){
      document.querySelector(".results").classList.remove("loading");
    }

    function mostrarErroNaLista(texto){
      document.getElementById("listaVagas").innerHTML = "";
      document.getElementById("paginacao").innerHTML = "";
      document.getElementById("contadorResultados").textContent = "Falha ao carregar vagas";
      document.getElementById("subtituloResultados").textContent = "Verifique a API.";
      const vazioEl = document.getElementById("mensagemVazia");
      vazioEl.style.display = "block";
      vazioEl.textContent = texto;
    }

    function preencherEstados(){
      const paisSelecionado = paisEl.value;
      let estados = vagas
        .filter(v => !paisSelecionado || paisSelecionado === "all" || v.paisCode === paisSelecionado)
        .map(v => v.estado)
        .filter(Boolean);

      estados = [...new Set(estados)].sort((a,b) => a.localeCompare(b, "pt-BR"));
      const atual = estadoEl.value;
      estadoEl.innerHTML = `<option value="">Todos</option>` + estados.map(e => `<option value="${escaparHtml(e)}">${escaparHtml(e)}</option>`).join("");
      if (estados.includes(atual)) estadoEl.value = atual;
    }

    function preencherCidades(){
      const paisSelecionado = paisEl.value;
      const estadoSelecionado = estadoEl.value;

      let cidades = vagas
        .filter(v => (!paisSelecionado || paisSelecionado === "all" || v.paisCode === paisSelecionado) && (!estadoSelecionado || v.estado === estadoSelecionado))
        .map(v => v.cidade)
        .filter(Boolean);

      cidades = [...new Set(cidades)].sort((a,b) => a.localeCompare(b, "pt-BR"));
      const atual = cidadeEl.value;
      cidadeEl.innerHTML = `<option value="">Todas as cidades</option>` + cidades.map(c => `<option value="${escaparHtml(c)}">${escaparHtml(c)}</option>`).join("");
      if (cidades.includes(atual)) cidadeEl.value = atual;
    }

    function atualizarContadores(){
      document.getElementById("totalVagas").textContent = vagas.length;
      document.getElementById("totalPaises").textContent = [...new Set(vagas.map(v => v.paisCode))].length;
      document.getElementById("totalFavoritas").textContent = vagasFavoritas.length;
    }

    function criarTag(texto, flag = ""){
      const span = document.createElement("span");
      span.className = "tag";
      if (flag) {
        const flagEl = document.createElement("span");
        flagEl.className = "flag";
        flagEl.textContent = flag;
        span.appendChild(flagEl);
      }
      span.appendChild(document.createTextNode(texto));
      return span;
    }

    function ordenarLista(lista){
      return lista.sort((a, b) => valorBaseSalario(b) - valorBaseSalario(a));
    }

    function dentroDaFaixa(salario, faixa){
      if (!faixa) return true;
      const [min,max] = faixa.split("-").map(Number);
      return salario >= min && salario <= max;
    }

    function toggleSelecaoArray(arrayRef, valor){
      const indice = arrayRef.indexOf(valor);
      if (indice >= 0) arrayRef.splice(indice, 1);
      else arrayRef.push(valor);
    }

    function setMultiSelectChip(groupId, attr, arrayRef){
      const chips = document.querySelectorAll(`#${groupId} .chip`);
      chips.forEach(chip => {
        chip.addEventListener("click", () => {
          const valor = chip.getAttribute(attr) || "";
          toggleSelecaoArray(arrayRef, valor);
          chip.classList.toggle("active");
          filtrarVagas();
        });
      });
    }

    setMultiSelectChip("filtroModalidade", "data-modalidade", modalidadesSelecionadas);
    setMultiSelectChip("filtroArea", "data-area", areasSelecionadas);

    function toggleFavorita(id){
      const vaga = vagas.find(v => v.id === id);
      if (vagasFavoritas.includes(id)) {
        vagasFavoritas = vagasFavoritas.filter(v => v !== id);
        mostrarToast(`Removida de salvas: ${vaga?.titulo || "vaga"}`);
      } else {
        vagasFavoritas.push(id);
        mostrarToast(`Salva com sucesso: ${vaga?.titulo || "vaga"}`);
      }
      salvarFavoritas();
      atualizarContadores();
      filtrarVagas();
    }

    async function copiarLink(url){
      try{
        await navigator.clipboard.writeText(url);
        mostrarToast("Link da vaga copiado");
      } catch {
        mostrarToast("Não foi possível copiar o link");
      }
    }

    function renderizarPaginacao(totalItens){
      const paginacaoEl = document.getElementById("paginacao");
      const totalPaginas = Math.ceil(totalItens / vagasPorPagina);
      paginacaoEl.innerHTML = "";
      if (totalPaginas <= 1) return;

      function criarBotaoPagina(texto, pagina, ativo = false, desabilitado = false){
        const btn = document.createElement("button");
        btn.className = `page-btn ${ativo ? "active" : ""}`;
        btn.textContent = texto;
        btn.disabled = desabilitado;
        if (!desabilitado) btn.onclick = () => mudarPagina(pagina);
        return btn;
      }

      paginacaoEl.appendChild(criarBotaoPagina("‹", paginaAtual - 1, false, paginaAtual === 1));

      let inicio = Math.max(1, paginaAtual - 2);
      let fim = Math.min(totalPaginas, paginaAtual + 2);
      if (paginaAtual <= 3) fim = Math.min(totalPaginas, 5);
      if (paginaAtual >= totalPaginas - 2) inicio = Math.max(1, totalPaginas - 4);

      for (let i = inicio; i <= fim; i++) {
        paginacaoEl.appendChild(criarBotaoPagina(i, i, i === paginaAtual));
      }

      paginacaoEl.appendChild(criarBotaoPagina("›", paginaAtual + 1, false, paginaAtual === totalPaginas));
    }

    function montarLinkFinal(vaga){
      const linkOriginal = typeof vaga.link === "string" ? vaga.link.trim() : "";
      const linkValido = /^https?:\/\//i.test(linkOriginal) && !linkOriginal.includes("example.com");
      const fonte = (vaga.sourceName || "").toLowerCase();

      if (fonte === "brasil json" && linkValido) return linkOriginal;
      if (fonte === "usajobs" && linkValido) return linkOriginal;
      if (fonte === "remotive" && linkValido) return linkOriginal;

      const termoBusca = `${vaga.titulo} ${vaga.empresa} ${vaga.pais}`.trim();
      return `https://www.google.com/search?q=${encodeURIComponent(termoBusca)}`;
    }

    function renderizarVagas(lista){
      atualizarContadores();
      document.getElementById("totalFiltradas").textContent = lista.length;

      const listaEl = document.getElementById("listaVagas");
      const vazioEl = document.getElementById("mensagemVazia");
      const contadorEl = document.getElementById("contadorResultados");
      const subtituloEl = document.getElementById("subtituloResultados");

      contadorEl.textContent = `${lista.length} vaga${lista.length !== 1 ? "s" : ""} encontrada${lista.length !== 1 ? "s" : ""}`;
      subtituloEl.textContent =
        abaAtual === "salvas"
          ? "Estas são as vagas que você marcou como interesse."
          : "Filtrando por país, modalidade, área e faixa salarial.";

      listaEl.innerHTML = "";

      if (!lista.length){
        vazioEl.style.display = "block";
        vazioEl.textContent = abaAtual === "salvas"
          ? "Você ainda não salvou nenhuma vaga de interesse."
          : "Nenhuma vaga encontrada com os filtros selecionados.";
        document.getElementById("paginacao").innerHTML = "";
        return;
      }

      vazioEl.style.display = "none";

      const inicio = (paginaAtual - 1) * vagasPorPagina;
      const fim = inicio + vagasPorPagina;
      const vagasPagina = lista.slice(inicio, fim);

      vagasPagina.forEach(vaga => {
        const favorita = vagasFavoritas.includes(vaga.id);
        const card = document.createElement("article");
        card.className = "card";

        const favBtn = document.createElement("button");
        favBtn.className = `favorite-toggle ${favorita ? "active" : ""}`;
        favBtn.title = favorita ? "Remover dos salvos" : "Salvar vaga";
        favBtn.textContent = favorita ? "♥" : "♡";
        favBtn.addEventListener("click", () => toggleFavorita(vaga.id));
        card.appendChild(favBtn);

        if (favorita){
          const badge = document.createElement("div");
          badge.className = "favorite-badge";
          badge.textContent = "⭐ Interesse";
          card.appendChild(badge);
        }

        const company = document.createElement("div");
        company.className = "company";
        company.textContent = vaga.empresa;
        card.appendChild(company);

        const title = document.createElement("div");
        title.className = "title";
        title.textContent = vaga.titulo;
        card.appendChild(title);

        const salary = document.createElement("div");
        salary.className = "salary";
        salary.textContent = formatarSalarioCompleto(vaga);
        card.appendChild(salary);

        const salaryBadge = document.createElement("div");
        salaryBadge.className = `salary-badge ${vaga.salaryType === "estimado" ? "salary-estimated" : "salary-real"}`;
        salaryBadge.textContent = vaga.salaryType === "estimado" ? "💡 Faixa estimada" : "💰 Salário informado";
        card.appendChild(salaryBadge);

        const sourceBadge = document.createElement("div");
        sourceBadge.className = "source-badge";
        sourceBadge.textContent = `Fonte: ${vaga.sourceName || vaga.paisCode.toUpperCase()}`;
        card.appendChild(sourceBadge);

        const destinoFinal = montarLinkFinal(vaga);
        const ehGoogleFallback = destinoFinal.includes("google.com/search?q=");

        const linkBadge = document.createElement("div");
        linkBadge.className = "link-badge";
        linkBadge.textContent = ehGoogleFallback ? "Destino: Busca web" : "Destino: Link direto";
        card.appendChild(linkBadge);

        const tags = document.createElement("div");
        tags.className = "tags";
        tags.appendChild(criarTag(vaga.pais, vaga.flag));
        tags.appendChild(criarTag(vaga.cidade));
        tags.appendChild(criarTag(vaga.estado));
        tags.appendChild(criarTag(vaga.modalidade));
        tags.appendChild(criarTag(vaga.area));
        card.appendChild(tags);

        const desc = document.createElement("div");
        desc.className = "desc";
        desc.textContent = vaga.descricao;
        card.appendChild(desc);

        const meta = document.createElement("div");
        meta.className = "meta";
        meta.innerHTML = `
          <div><strong>País:</strong> ${escaparHtml(vaga.pais)}</div>
          <div><strong>Estado / Região:</strong> ${escaparHtml(vaga.estado)}</div>
          <div><strong>Cidade:</strong> ${escaparHtml(vaga.cidade)}</div>
          <div><strong>Modalidade:</strong> ${escaparHtml(vaga.modalidade)}</div>
          <div><strong>Área:</strong> ${escaparHtml(vaga.area)}</div>
          <div><strong>Origem:</strong> ${escaparHtml(vaga.sourceName || vaga.paisCode.toUpperCase())}</div>
        `;
        card.appendChild(meta);

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const linkBusca = `https://www.google.com/search?q=${encodeURIComponent(vaga.titulo + " " + vaga.empresa + " " + vaga.pais)}`;

        const a1 = document.createElement("a");
        a1.className = "btn btn-link";
        a1.href = destinoFinal;
        a1.target = "_blank";
        a1.rel = "noopener noreferrer";
        a1.textContent = ehGoogleFallback ? "Buscar vaga" : "Ver vaga";

        const a2 = document.createElement("a");
        a2.className = "btn btn-secondary btn-search";
        a2.href = linkBusca;
        a2.target = "_blank";
        a2.rel = "noopener noreferrer";
        a2.textContent = "Buscar em portais";

        const b3 = document.createElement("button");
        b3.className = "btn btn-secondary btn-copy";
        b3.textContent = "Copiar link";
        b3.addEventListener("click", () => copiarLink(destinoFinal));

        actions.appendChild(a1);
        actions.appendChild(a2);
        actions.appendChild(b3);
        card.appendChild(actions);

        listaEl.appendChild(card);
      });

      renderizarPaginacao(lista.length);
    }

    function filtrarVagas(){
      const busca = buscaEl.value.toLowerCase().trim();
      const pais = paisEl.value;
      const estado = estadoEl.value;
      const cidade = cidadeEl.value;
      const faixa = faixaEl.value;

      let lista = vagas.filter(vaga => {
        const texto = `${vaga.titulo} ${vaga.empresa} ${vaga.cidade} ${vaga.estado} ${vaga.pais} ${vaga.area} ${vaga.modalidade}`.toLowerCase();
        const okBusca = !busca || texto.includes(busca);
        const okPais = !pais || pais === "all" || vaga.paisCode === pais;
        const okEstado = !estado || vaga.estado === estado;
        const okCidade = !cidade || vaga.cidade === cidade;
        const okModalidade = !modalidadesSelecionadas.length || modalidadesSelecionadas.includes(vaga.modalidade);
        const okArea = !areasSelecionadas.length || areasSelecionadas.includes(vaga.area);
        const valorBRL = vaga.salaryType === "estimado"
          ? vaga.salaryEstimated
          : (vaga.currency === "BRL" ? vaga.salario : converterParaBRL(vaga.salario, vaga.currency || "USD"));
        const okFaixa = dentroDaFaixa(valorBRL || 0, faixa);

        return okBusca && okPais && okEstado && okCidade && okModalidade && okArea && okFaixa;
      });

      if (abaAtual === "salvas"){
        lista = lista.filter(vaga => vagasFavoritas.includes(vaga.id));
      }

      lista = ordenarLista(lista);
      listaFiltradaAtual = lista;
      paginaAtual = 1;
      preencherEstados();
      preencherCidades();
      renderizarVagas(lista);
    }

    async function buscarVagas(forcarAtualizacao = false){
      try{
        setStatus("Carregando");
        renderizarSkeleton(6);

        const pais = paisEl.value || "all";
        let busca = buscaEl.value.trim();
        if (!busca) busca = termoPadraoPorPais(pais);

        vagas = await carregarVagas();
        filtrarVagas();
        setStatus("OK");
        mostrarToast(`Busca concluída: ${vagas.length} vagas`);
      } catch (e) {
        console.error(e);
        vagas = [];
        setStatus("Erro");
        mostrarErroNaLista(e.message || "Erro ao carregar vagas.");
      } finally {
        esconderSkeleton();
      }
    }

    function limparFiltros(){
      buscaEl.value = "";
      paisEl.value = "all";
      estadoEl.value = "";
      cidadeEl.value = "";
      faixaEl.value = "";
      modalidadesSelecionadas = [];
      areasSelecionadas = [];
      document.querySelectorAll(".chip").forEach(chip => chip.classList.remove("active"));
      paginaAtual = 1;
      buscarVagas(true);
    }

    function trocarAba(aba){
      abaAtual = aba;
      paginaAtual = 1;
      document.getElementById("tabTodas").classList.toggle("active", aba === "todas");
      document.getElementById("tabSalvas").classList.toggle("active", aba === "salvas");
      document.getElementById("painelSalvas").classList.toggle("show", aba === "salvas");
      atualizarAcoesSalvas();
      filtrarVagas();
    }

    function limparVagasSalvas(){
      if (!vagasFavoritas.length){
        mostrarToast("Não há vagas salvas para limpar");
        return;
      }
      vagasFavoritas = [];
      salvarFavoritas();
      atualizarContadores();
      filtrarVagas();
    }

    function exportarFavoritasCSV(){
      const favoritas = vagas.filter(vaga => vagasFavoritas.includes(vaga.id));
      if (!favoritas.length){
        mostrarToast("Nenhuma vaga salva para exportar");
        return;
      }

      const cabecalho = ["Título","Empresa","País","Cidade","Modalidade","Área","Salário","Tipo","Fonte","Link"];
      const linhas = favoritas.map(vaga => [
        vaga.titulo,
        vaga.empresa,
        vaga.pais,
        vaga.cidade,
        vaga.modalidade,
        vaga.area,
        formatarSalarioCompleto(vaga),
        vaga.salaryType || "",
        vaga.sourceName || "",
        montarLinkFinal(vaga)
      ]);

      const conteudo = [cabecalho, ...linhas]
        .map(linha => linha.map(valor => `"${String(valor).replace(/"/g, '""')}"`).join(";"))
        .join("\n");

      const blob = new Blob(["\uFEFF" + conteudo], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "vagas-salvas.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      mostrarToast("CSV exportado com sucesso");
    }

    function mudarPagina(pagina){
      const totalPaginas = Math.ceil(listaFiltradaAtual.length / vagasPorPagina);
      if (pagina < 1 || pagina > totalPaginas) return;
      paginaAtual = pagina;
      renderizarVagas(listaFiltradaAtual);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    paisEl.addEventListener("change", () => buscarVagas(true));
    estadoEl.addEventListener("change", filtrarVagas);
    cidadeEl.addEventListener("change", filtrarVagas);
    faixaEl.addEventListener("change", filtrarVagas);

    buscaEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        buscarVagas(true);
      }
    });

    atualizarTotalFavoritas();
    atualizarAcoesSalvas();
    buscarVagas(false);