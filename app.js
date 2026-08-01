/* ============================================================
   Insight Careers v2
   app.js
   ============================================================ */

"use strict";

/* ============================================================
   CONFIGURAÇÕES
============================================================ */

const VAGAS_POR_PAGINA = 18;

let vagas = [];
let vagasFiltradas = [];
let paginaAtual = 1;

let favoritas =
    JSON.parse(localStorage.getItem("favoritas")) || [];

let modalidadesSelecionadas = [];
let areasSelecionadas = [];

let abaAtual = "todas";

/* ============================================================
   ELEMENTOS
============================================================ */

const buscaEl = document.getElementById("busca");
const paisEl = document.getElementById("pais");
const estadoEl = document.getElementById("estado");
const cidadeEl = document.getElementById("cidade");
const faixaEl = document.getElementById("faixaSalario");

const listaEl = document.getElementById("listaVagas");
const paginacaoEl = document.getElementById("paginacao");
const vazioEl = document.getElementById("mensagemVazia");

const contadorResultados =
    document.getElementById("contadorResultados");

const subtituloResultados =
    document.getElementById("subtituloResultados");

const totalVagas =
    document.getElementById("totalVagas");

const totalFiltradas =
    document.getElementById("totalFiltradas");

const totalFavoritas =
    document.getElementById("totalFavoritas");

const totalPaises =
    document.getElementById("totalPaises");

const statusEl =
    document.getElementById("status");

const toast =
    document.getElementById("toast");

/* ============================================================
   TOAST
============================================================ */

function mostrarToast(texto){

    toast.textContent = texto;

    toast.classList.add("show");

    clearTimeout(window.toastTimeout);

    window.toastTimeout = setTimeout(() => {

        toast.classList.remove("show");

    },2500);

}

/* ============================================================
   STATUS
============================================================ */

function setStatus(texto){

    statusEl.textContent = texto;

}

/* ============================================================
   FAVORITOS
============================================================ */

function salvarFavoritas(){

    localStorage.setItem(
        "favoritas",
        JSON.stringify(favoritas)
    );

}

function atualizarTotalFavoritas(){

    totalFavoritas.textContent = favoritas.length;

}

/* ============================================================
   UTILITÁRIOS
============================================================ */

function moeda(valor){

    if(!valor)
        return "Salário a combinar";

    return Number(valor).toLocaleString("pt-BR",{

        style:"currency",
        currency:"BRL"

    });

}

function limparElemento(el){

    el.innerHTML = "";

}

function unique(lista){

    return [...new Set(lista)];

}/* ============================================================
   CARREGAMENTO DAS VAGAS
============================================================ */

async function carregarVagas(){

    setStatus("Carregando...");

    try{

        const response = await fetch("br_jobs.json");

        if(!response.ok){

            throw new Error("Não foi possível carregar br_jobs.json");

        }

        const dados = await response.json();

        vagas = dados.map(vaga=>{

            return{

                ...vaga,

                modalidade: vaga.modalidade || "Presencial",

                area: vaga.area || "Geral",

                salario:
                    Number(vaga.salario || 0),

                salaryEstimated:
                    Number(vaga.salaryEstimated || 0)

            };

        });

        atualizarContadores();

        preencherEstados();

        preencherCidades();

        setStatus("OK");

        return vagas;

    }

    catch(erro){

        console.error(erro);

        setStatus("Erro");

        mostrarToast("Erro ao carregar vagas.");

        return [];

    }

}/* ============================================================
   CONTADORES
============================================================ */

function atualizarContadores(){

    totalVagas.textContent =
        vagas.length;

    totalFiltradas.textContent =
        vagasFiltradas.length || vagas.length;

    totalFavoritas.textContent =
        favoritas.length;

    totalPaises.textContent =

        unique(

            vagas.map(v=>v.paisCode)

        ).length;

}
/* ============================================================
   ESTADOS
============================================================ */

function preencherEstados(){

    const pais = paisEl.value;

    let lista = vagas
        .filter(v=>!pais || pais==="all" || v.paisCode===pais)
        .map(v=>v.estado)
        .filter(Boolean);

    lista = unique(lista).sort();

    estadoEl.innerHTML =
        '<option value="">Todos</option>';

    lista.forEach(item=>{

        estadoEl.innerHTML +=
            `<option value="${item}">${item}</option>`;

    });

}
/* ============================================================
   CIDADES
============================================================ */

function preencherCidades(){

    const pais = paisEl.value;

    const estado = estadoEl.value;

    let lista = vagas
        .filter(v=>

            (!pais || pais==="all" || v.paisCode===pais)

            &&

            (!estado || v.estado===estado)

        )
        .map(v=>v.cidade)
        .filter(Boolean);

    lista = unique(lista).sort();

    cidadeEl.innerHTML =
        '<option value="">Todas as cidades</option>';

    lista.forEach(item=>{

        cidadeEl.innerHTML +=
            `<option value="${item}">${item}</option>`;

    });

}
/* ============================================================
   RENDERIZAÇÃO
============================================================ */

function renderizarVagas(lista = vagas){

    vagasFiltradas = lista;

    atualizarContadores();

    limparElemento(listaEl);

    if(lista.length === 0){

        vazioEl.style.display = "block";
        paginacaoEl.innerHTML = "";

        contadorResultados.textContent = "0 vagas";
        subtituloResultados.textContent = "Nenhum resultado encontrado.";

        return;
    }

    vazioEl.style.display = "none";

    contadorResultados.textContent =
        `${lista.length} vagas`;

    subtituloResultados.textContent =
        "Resultados encontrados";

    const inicio = (paginaAtual - 1) * VAGAS_POR_PAGINA;

    const fim = inicio + VAGAS_POR_PAGINA;

    const pagina = lista.slice(inicio,fim);

    pagina.forEach(vaga=>{

        listaEl.appendChild(

            criarCard(vaga)

        );

    });

}
function criarCard(vaga){

    const card = document.createElement("article");

    card.className = "card";

    const favorita = favoritas.includes(vaga.id);

    card.innerHTML = `

        <div class="card-top">

            <div>

                <span class="badge">

                    ${vaga.modalidade}

                </span>

            </div>

            <button
                class="btn-favorito"
                data-id="${vaga.id}">

                ${favorita ? "❤️" : "🤍"}

            </button>

        </div>

        <h3>

            ${vaga.titulo || "Sem título"}

        </h3>

        <p>

            ${vaga.empresa || ""}

        </p>

        <p>

            📍 ${vaga.cidade || ""}

            ${vaga.estado ? " - " + vaga.estado : ""}

        </p>

        <p>

            💰 ${moeda(

                vaga.salaryEstimated ||
                vaga.salario

            )}

        </p>

        <p>

            ${vaga.area || ""}

        </p>

    `;

    return card;

}
/* ============================================================
   INICIALIZAÇÃO
============================================================ */


document.addEventListener("DOMContentLoaded", async () => {

    await carregarVagas();

    renderizarVagas(vagas);

    buscaEl.addEventListener("input", aplicarFiltros);

    paisEl.addEventListener("change", () => {

        preencherEstados();

        preencherCidades();

        aplicarFiltros();

    });

    estadoEl.addEventListener("change", () => {

        preencherCidades();

        aplicarFiltros();

    });

});

/* ============================================================
   FILTRO 
============================================================ */

function aplicarFiltros(){

    const texto = buscaEl.value
        .trim()
        .toLowerCase();

    const paisSelecionado = paisEl.value;
    const estadoSelecionado = estadoEl.value;
    const faixaSelecionada = faixaEl.value;

    let resultado = vagas.filter(v=>{

        const conteudo = [

            v.titulo,
            v.empresa,
            v.descricao,
            v.area,
            v.modalidade,
            v.cidade,
            v.estado

        ]
        .join(" ")
        .toLowerCase();

        const okBusca =
            !texto ||
            conteudo.includes(texto);

        const okPais =

            paisSelecionado==="all"

            ||

            v.paisCode===paisSelecionado;

       const okEstado =
    !estadoSelecionado ||
    v.estado === estadoSelecionado;

        let okSalario = true;

if (faixaSelecionada) {

    const [min, max] = faixaSelecionada
        .split("-")
        .map(Number);

    const salario = Number(
        v.salaryEstimated || v.salario || 0
    );

    okSalario =
        salario >= min &&
        salario <= max;

}

   rreturn (
    okBusca
    && okPais
    && (
        !estadoSelecionado ||
        v.estado === estadoSelecionado
    )
    && okSalario
);

    });

    paginaAtual = 1;

    renderizarVagas(resultado);

}
