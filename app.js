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