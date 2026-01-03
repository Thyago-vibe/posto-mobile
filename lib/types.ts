
export interface Posto {
    id: number;
    nome: string;
    cnpj: string | null;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
    telefone: string | null;
    email: string | null;
    ativo: boolean;
}

export interface Frentista {
    id: number;
    nome: string;
    cpf: string | null;
    telefone: string | null;
    data_admissao: string | null;
    ativo: boolean;
    user_id: string | null;
    turno_id?: number | null;
    posto_id: number;
}

export interface Turno {
    id: number;
    nome: string;
    horario_inicio: string;
    horario_fim: string;
}

export interface Usuario {
    id: number;
    nome: string;
    email: string;
    role: string;
    posto_id?: number;
}

export interface Fechamento {
    id: number;
    data: string;
    usuario_id: string;
    turno_id: number;
    status: string;
    total_vendas?: number;
    total_recebido?: number;
    diferenca?: number;
    observacoes?: string;
    posto_id: number;
}

export interface Cliente {
    id: number;
    nome: string;
    documento?: string;
    posto_id?: number;
    ativo: boolean;
}

export interface NotaFrentistaInput {
    cliente_id: number;
    valor: number;
}

export interface FechamentoFrentista {
    id: number;
    fechamento_id: number;
    frentista_id: number;
    valor_cartao: number;
    valor_cartao_debito: number;
    valor_cartao_credito: number;
    valor_dinheiro: number;
    valor_pix: number;
    valor_nota: number;
    valor_conferido: number;
    baratao: number;
    diferenca: number;
    observacoes: string | null;
}

export interface SubmitClosingData {
    data: string;
    turno_id: number;
    valor_cartao_debito: number;
    valor_cartao_credito: number;
    valor_nota: number;
    valor_pix: number;
    valor_dinheiro: number;
    valor_baratao: number;
    valor_encerrante: number;
    falta_caixa: number;
    observacoes: string;
    posto_id: number;
    frentista_id?: number;
    notas?: NotaFrentistaInput[];
}

export interface Produto {
    id: number;
    nome: string;
    preco_venda: number;
    estoque_atual: number;
    categoria: string;
    ativo: boolean;
}

export interface Escala {
    id: number;
    frentista_id: number;
    data: string;
    tipo: 'FOLGA' | 'TRABALHO';
    turno_id?: number | null;
    observacao?: string | null;
}

export interface VendaProduto {
    id: number;
    frentista_id: number;
    produto_id: number;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
    data: string;
    fechamento_frentista_id?: number;
    Produto?: { nome: string };
}
