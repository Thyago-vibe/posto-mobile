import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Modal, FlatList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { submitMobileClosing, turnoService, frentistaService, clienteService, type SubmitClosingData, type Cliente, type Turno, type Frentista } from '../../lib/api';
import { usePosto } from '../../lib/PostoContext';
import {
    CreditCard,
    Receipt,
    Smartphone,
    Banknote,
    AlertTriangle,
    Check,
    Send,
    Calculator,
    CircleDollarSign,
    ChevronDown,
    Clock,
    User,
    Gauge,
    Plus,
    Trash2,
    X,
    Search,
    Coins,
    Ban,
    Calendar
} from 'lucide-react-native';

// Tipos
interface FormaPagamento {
    id: string;
    label: string;
    icon: any;
    color: string;
    bgColor: string;
}

interface NotaItem {
    cliente_id: number;
    cliente_nome: string;
    valor: string; // formato exibição
    valor_number: number;
}

interface RegistroTurno {
    valorEncerrante: string;
    valorCartaoDebito: string;
    valorCartaoCredito: string;
    valorPix: string;
    valorDinheiro: string;
    valorMoedas: string;
    valorBaratao: string;
    observacoes: string;
}

const FORMAS_PAGAMENTO: FormaPagamento[] = [
    { id: 'debito', label: 'Débito', icon: CreditCard, color: '#2563eb', bgColor: '#eff6ff' },
    { id: 'credito', label: 'Crédito', icon: CreditCard, color: '#7c3aed', bgColor: '#f5f3ff' },
    { id: 'nota', label: 'Nota/Vale', icon: Receipt, color: '#0891b2', bgColor: '#ecfeff' },
    { id: 'pix', label: 'PIX', icon: Smartphone, color: '#059669', bgColor: '#ecfdf5' },
    { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, color: '#16a34a', bgColor: '#f0fdf4' },
];

export default function RegistroScreen() {
    const insets = useSafeAreaInsets();
    const { postoAtivo, postoAtivoId } = usePosto();

    // Estados principais - Modo Plataforma Universal v1.4.0
    const [turnos, setTurnos] = useState<Turno[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [userName, setUserName] = useState('Frentista');
    const [turnoAtual, setTurnoAtual] = useState('Diário'); // Modo diário automático
    const [turnoId, setTurnoId] = useState<number | null>(null);
    const [frentistas, setFrentistas] = useState<Frentista[]>([]);
    const [frentistaId, setFrentistaId] = useState<number | null>(null);
    const [modalFrentistaVisible, setModalFrentistaVisible] = useState(false);
    const [frentistasQueFecharam, setFrentistasQueFecharam] = useState<number[]>([]);

    const [registro, setRegistro] = useState<RegistroTurno>({
        valorEncerrante: '',
        valorCartaoDebito: '',
        valorCartaoCredito: '',
        valorPix: '',
        valorDinheiro: '',
        valorMoedas: '',
        valorBaratao: '',
        observacoes: '',
    });

    const [notasAdicionadas, setNotasAdicionadas] = useState<NotaItem[]>([]);
    const [modalNotaVisible, setModalNotaVisible] = useState(false);
    // modalTurnoVisible REMOVIDO - Turno agora é automático (v1.4.0)
    const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
    const [valorNotaTemp, setValorNotaTemp] = useState('');
    const [buscaCliente, setBuscaCliente] = useState(''); // Novo estado para busca

    // Estados para Data de Fechamento
    const [dataFechamento, setDataFechamento] = useState<Date>(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [modalDataVisible, setModalDataVisible] = useState(false);

    // Formatação de Moeda
    const formatCurrency = (value: number): string => {
        return value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    };

    const parseValue = (value: string): number => {
        if (!value) return 0;
        const cleanStr = value.replace(/[^\d,]/g, '').replace(',', '.');
        const parsed = parseFloat(cleanStr);
        return isNaN(parsed) ? 0 : parsed;
    };

    /**
     * Formata a data para exibição no formato brasileiro (DD/MM/YYYY)
     */
    const formatDateDisplay = (date: Date): string => {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    /**
     * Formata a data para envio ao banco (YYYY-MM-DD)
     */
    const formatDateForDB = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    /**
     * Handler para mudança de data no DatePicker
     */
    const handleDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios'); // No iOS mantém aberto, no Android fecha
        if (selectedDate) {
            setDataFechamento(selectedDate);
        }
    };

    // Função para limpar formulário ao trocar de frentista (Modo Dispositivo Compartilhado)
    const resetFormulario = () => {
        setRegistro({
            valorEncerrante: '',
            valorCartaoDebito: '',
            valorCartaoCredito: '',
            valorPix: '',
            valorDinheiro: '',
            valorMoedas: '',
            valorBaratao: '',
            observacoes: '',
        });
        setNotasAdicionadas([]);
    };

    const formatCurrencyInput = (value: string) => {
        const onlyNumbers = value.replace(/\D/g, '');
        if (onlyNumbers === '') return '';
        const amount = parseInt(onlyNumbers) / 100;
        return amount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const handleChange = (field: keyof RegistroTurno, value: string) => {
        if (field === 'observacoes') {
            setRegistro(prev => ({ ...prev, [field]: value }));
            return;
        }
        const formatted = formatCurrencyInput(value);
        setRegistro(prev => ({ ...prev, [field]: formatted }));
    };

    // Cálculos
    const valorEncerrante = parseValue(registro.valorEncerrante);
    const totalCartao = parseValue(registro.valorCartaoDebito) + parseValue(registro.valorCartaoCredito);
    const totalNotas = notasAdicionadas.reduce((acc, current) => acc + current.valor_number, 0);
    const totalMoedas = parseValue(registro.valorMoedas);
    const totalInformado = totalCartao + totalNotas + parseValue(registro.valorPix) + parseValue(registro.valorDinheiro) + totalMoedas + parseValue(registro.valorBaratao);
    const diferencaCaixa = valorEncerrante - totalInformado;
    const temFalta = diferencaCaixa > 0;
    const temSobra = diferencaCaixa < 0;
    const caixaBateu = diferencaCaixa === 0 && valorEncerrante > 0;

    // Carregar dados (User, Turnos, Clientes)
    useEffect(() => {
        async function loadFrentistasQueFecharam(turnoIdParam: number) {
            if (!postoAtivoId || !turnoIdParam) return;

            try {
                const hoje = new Date().toISOString().split('T')[0];

                // Buscar fechamentos do turno atual
                const { data, error } = await supabase
                    .from('FechamentoFrentista')
                    .select(`
                        frentista_id,
                        fechamento_id,
                        Fechamento!inner(data, turno_id)
                    `)
                    .eq('Fechamento.data', hoje)
                    .eq('Fechamento.turno_id', turnoIdParam)
                    .eq('posto_id', postoAtivoId);

                if (error) {
                    console.error('Erro ao buscar fechamentos:', error);
                    return;
                }

                const frentistaIds = data?.map(f => f.frentista_id) || [];
                setFrentistasQueFecharam(frentistaIds);
            } catch (error) {
                console.error('Erro ao carregar frentistas que fecharam:', error);
            }
        }

        /**
         * loadAllData - Carrega todos os dados necessários para a tela
         * REFATORADO v1.4.0: Modo Universal sem verificação de admin
         * - Turno é determinado automaticamente (getCurrentTurno)
         * - Não há mais verificação de login/papel do usuário
         * - Todos os frentistas são carregados para seleção
         */
        async function loadAllData() {
            if (!postoAtivoId) return;

            setLoading(true);
            try {
                // Carregar Turnos, Clientes e Frentistas em paralelo
                const [turnosData, clientesData, turnoAuto, frentistasData] = await Promise.all([
                    turnoService.getAll(postoAtivoId),
                    clienteService.getAll(postoAtivoId),
                    turnoService.getCurrentTurno(postoAtivoId),
                    frentistaService.getAllByPosto(postoAtivoId)
                ]);

                setTurnos(turnosData);
                setClientes(clientesData);
                setFrentistas(frentistasData);

                // Determinar turno automaticamente (Modo Diário)
                let turnoIdFinal = null;

                if (turnoAuto) {
                    // Usa o turno automático baseado na hora atual
                    setTurnoId(turnoAuto.id);
                    turnoIdFinal = turnoAuto.id;
                } else if (turnosData.length > 0) {
                    // Fallback: primeiro turno disponível
                    setTurnoId(turnosData[0].id);
                    turnoIdFinal = turnosData[0].id;
                }

                // Carregar frentistas que já fecharam hoje
                if (turnoIdFinal) {
                    await loadFrentistasQueFecharam(turnoIdFinal);
                }
            } catch (error) {
                console.error('Erro ao carregar dados:', error);
            } finally {
                setLoading(false);
            }
        }

        loadAllData();

        // Realtime para Turnos e Fechamentos
        const subscription = supabase
            .channel('turnos_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'Turno' }, () => loadAllData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'FechamentoFrentista' }, () => {
                if (turnoId) loadFrentistasQueFecharam(turnoId);
            })
            .subscribe();

        return () => { subscription.unsubscribe(); };
    }, [postoAtivoId]);

    const handleAddNota = () => {
        if (!selectedCliente || !valorNotaTemp) {
            Alert.alert('Atenção', 'Selecione um cliente e informe o valor');
            return;
        }

        // Verificar se o cliente está bloqueado
        if (selectedCliente.bloqueado) {
            Alert.alert(
                'Cliente Bloqueado',
                `O cliente ${selectedCliente.nome} está bloqueado e não pode realizar novas compras a prazo. Entre em contato com a administração.`,
                [{ text: 'OK' }]
            );
            return;
        }

        const valorNumber = parseValue(valorNotaTemp);
        if (valorNumber <= 0) {
            Alert.alert('Atenção', 'O valor deve ser maior que zero');
            return;
        }

        const novaNota: NotaItem = {
            cliente_id: selectedCliente.id,
            cliente_nome: selectedCliente.nome,
            valor: valorNotaTemp,
            valor_number: valorNumber
        };

        setNotasAdicionadas(prev => [...prev, novaNota]);
        setModalNotaVisible(false);
        setSelectedCliente(null);
        setValorNotaTemp('');
    };

    const handleRemoveNota = (index: number) => {
        setNotasAdicionadas(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (valorEncerrante === 0) {
            Alert.alert('Atenção', 'Informe o valor do encerrante');
            return;
        }

        if (totalInformado === 0) {
            Alert.alert('Atenção', 'Preencha pelo menos um valor de pagamento');
            return;
        }

        if (!turnoId) {
            // Tentativa de recuperação de emergência
            setLoading(true);
            try {
                const retryTurno = await turnoService.getCurrentTurno(postoAtivoId!);
                if (retryTurno) {
                    setTurnoId(retryTurno.id);
                    // Prossiga se recuperou
                } else {
                    Alert.alert(
                        'Erro de Configuração',
                        `Não foi possível identificar o turno para o posto (ID: ${postoAtivoId}).\n\nVerifique se os turnos estão ativos no painel administrativo.`
                    );
                    setLoading(false);
                    return;
                }
            } catch (e) {
                Alert.alert('Erro Crítico', 'Falha na comunicação com o servidor ao buscar turnos.');
                setLoading(false);
                return;
            }
        }

        // Montar mensagem de confirmação
        let mensagemConfirmacao = `Data: ${formatDateDisplay(dataFechamento)}\nEncerrante: ${formatCurrency(valorEncerrante)}\nTotal Pagamentos: ${formatCurrency(totalInformado)}`;

        if (caixaBateu) {
            mensagemConfirmacao += '\n\n✅ Caixa bateu!';
        } else if (temFalta) {
            mensagemConfirmacao += `\n\n❌ Falta: ${formatCurrency(diferencaCaixa)}`;
        } else if (temSobra) {
            mensagemConfirmacao += `\n\n⚠️ Sobra: ${formatCurrency(Math.abs(diferencaCaixa))}`;
        }

        Alert.alert(
            'Confirmar Envio',
            mensagemConfirmacao,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        setSubmitting(true);
                        try {
                            // Preparar dados para envio - USANDO DATA SELECIONADA
                            const closingData: SubmitClosingData = {
                                data: formatDateForDB(dataFechamento),
                                turno_id: turnoId!,
                                valor_cartao_debito: parseValue(registro.valorCartaoDebito),
                                valor_cartao_credito: parseValue(registro.valorCartaoCredito),
                                valor_nota: totalNotas,
                                valor_pix: parseValue(registro.valorPix),
                                valor_dinheiro: parseValue(registro.valorDinheiro),
                                valor_moedas: parseValue(registro.valorMoedas),
                                valor_baratao: parseValue(registro.valorBaratao),
                                valor_encerrante: valorEncerrante,
                                falta_caixa: temFalta ? diferencaCaixa : 0,
                                observacoes: registro.observacoes,
                                posto_id: postoAtivoId!,
                                frentista_id: frentistaId || undefined,
                                notas: notasAdicionadas.map(n => ({
                                    cliente_id: n.cliente_id,
                                    valor: n.valor_number
                                }))
                            };

                            // Enviar para o Supabase
                            const result = await submitMobileClosing(closingData);

                            if (result.success) {
                                Alert.alert(
                                    '✅ Enviado!',
                                    result.message,
                                    [{
                                        text: 'OK',
                                        onPress: () => {
                                            // Limpar formulário
                                            setRegistro({
                                                valorEncerrante: '',
                                                valorCartaoDebito: '',
                                                valorCartaoCredito: '',
                                                valorPix: '',
                                                valorDinheiro: '',
                                                valorMoedas: '',
                                                valorBaratao: '',
                                                observacoes: '',
                                            });
                                            setNotasAdicionadas([]);
                                        }
                                    }]
                                );
                            } else {
                                Alert.alert('❌ Erro', result.message);
                            }
                        } catch (error) {
                            console.error('Error submitting closing:', error);
                            Alert.alert(
                                'Erro',
                                'Não foi possível enviar o registro. Verifique sua conexão e tente novamente.'
                            );
                        } finally {
                            setSubmitting(false);
                        }
                    }
                }
            ]
        );
    };

    const renderInputField = (
        forma: FormaPagamento,
        value: string,
        field: keyof RegistroTurno
    ) => {
        const Icon = forma.icon;
        return (
            <View key={forma.id} className="mb-4">
                <View
                    className="flex-row items-center bg-white rounded-2xl border-2 border-gray-100 overflow-hidden"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
                >
                    <View
                        className="p-4 items-center justify-center"
                        style={{ backgroundColor: forma.bgColor }}
                    >
                        <Icon size={24} color={forma.color} />
                    </View>
                    <View className="flex-1 px-4">
                        <Text className="text-xs text-gray-400 font-medium">{forma.label}</Text>
                        <View className="flex-row items-center">
                            <Text className="text-gray-500 text-lg font-medium mr-1">R$</Text>
                            <TextInput
                                className="flex-1 text-xl font-bold text-gray-800 py-2"
                                placeholder="0,00"
                                placeholderTextColor="#d1d5db"
                                value={value}
                                onChangeText={(text) => handleChange(field, text)}
                                keyboardType="decimal-pad"
                            />
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-gray-50"
        >
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: insets.bottom + 180 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Header Card - Modo Universal sem Login
                 * ALTERAÇÃO v1.4.0: Dropdown de frentistas SEMPRE visível
                 * Qualquer pessoa pode selecionar qual frentista está registrando
                 * Turno é determinado automaticamente (igual ao dashboard web)
                 */}
                <View
                    className="mx-4 mt-4 p-5 bg-white rounded-3xl border border-gray-100"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}
                >
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                            <View className="w-12 h-12 bg-primary-100 rounded-full items-center justify-center">
                                <User size={24} color="#b91c1c" />
                            </View>
                            <View>
                                {/* Dropdown SEMPRE ativo - Modo Plataforma Universal */}
                                <TouchableOpacity
                                    onPress={() => setModalFrentistaVisible(true)}
                                    className="flex-row items-center gap-1"
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-lg font-bold text-gray-800">
                                        {frentistaId ? `Olá, ${userName}!` : 'Selecionar Frentista'}
                                    </Text>
                                    <ChevronDown size={16} color="#4b5563" />
                                </TouchableOpacity>
                                <Text className="text-sm text-gray-500">{postoAtivo?.nome || 'Posto Providência'}</Text>
                            </View>
                        </View>
                        {/* Badge de Modo Diário (apenas informativo, não clicável) */}
                        <View className="bg-gray-100 px-3 py-1.5 rounded-full">
                            <Text className="text-gray-600 font-bold text-xs">Diário</Text>
                        </View>
                    </View>
                </View>


                {/* Card de Seleção de Data de Fechamento */}
                <View
                    className="mx-4 mt-3 p-4 bg-white rounded-2xl border border-gray-100"
                    style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
                >
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center">
                                <Calendar size={20} color="#2563eb" />
                            </View>
                            <View>
                                <Text className="text-xs text-gray-500 font-medium uppercase tracking-wider">Data do Fechamento</Text>
                                <Text className="text-base font-bold text-gray-800">{formatDateDisplay(dataFechamento)}</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={() => {
                                if (Platform.OS === 'android') {
                                    setShowDatePicker(true);
                                } else {
                                    setModalDataVisible(true);
                                }
                            }}
                            className="bg-blue-600 px-4 py-2 rounded-xl"
                            activeOpacity={0.7}
                        >
                            <Text className="text-white font-bold text-sm">Alterar</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Modal de Seleção de Turno - REMOVIDO em v1.4.0
                 * Turno agora é determinado automaticamente pela hora do dia,
                 * igual ao comportamento do dashboard web (Modo Diário).
                 */}

                {/* Modal de Seleção de Frentista (Modo Dispositivo Compartilhado) */}
                <Modal
                    visible={modalFrentistaVisible}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setModalFrentistaVisible(false)}
                >
                    <View className="flex-1 bg-black/60 justify-end">
                        <TouchableOpacity
                            className="absolute inset-0"
                            onPress={() => setModalFrentistaVisible(false)}
                        />
                        <View className="bg-white rounded-t-[32px] shadow-2xl" style={{ maxHeight: '60%' }}>
                            {/* Header */}
                            <View className="bg-primary-700 p-5 rounded-t-[32px] flex-row justify-between items-center">
                                <View>
                                    <Text className="text-white font-bold text-xl">Quem está trabalhando?</Text>
                                    <Text className="text-primary-200 text-sm mt-0.5">{frentistas.length} frentistas ativos</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setModalFrentistaVisible(false)}
                                    className="bg-white/20 p-2 rounded-full"
                                >
                                    <X size={22} color="white" />
                                </TouchableOpacity>
                            </View>

                            {/* Lista de Frentistas */}
                            <FlatList
                                data={frentistas}
                                keyExtractor={(item) => item.id.toString()}
                                contentContainerStyle={{ paddingVertical: 8 }}
                                renderItem={({ item }) => {
                                    const isSelected = item.id === frentistaId;
                                    const jaFechou = frentistasQueFecharam.includes(item.id);
                                    const inicial = item.nome.charAt(0).toUpperCase();
                                    return (
                                        <TouchableOpacity
                                            className={`mx-4 my-1.5 p-4 rounded-2xl flex-row justify-between items-center ${isSelected ? 'bg-primary-50 border-2 border-primary-200' : 'bg-gray-50'}`}
                                            onPress={() => {
                                                // Se trocou de frentista, limpa o formulário
                                                if (item.id !== frentistaId) {
                                                    resetFormulario();
                                                }
                                                setFrentistaId(item.id);
                                                setUserName(item.nome);
                                                setModalFrentistaVisible(false);
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View className="flex-row items-center gap-4">
                                                {/* Avatar com Inicial */}
                                                <View className={`w-12 h-12 rounded-full items-center justify-center ${isSelected ? 'bg-primary-700' : 'bg-gray-300'}`}>
                                                    <Text className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                                                        {inicial}
                                                    </Text>
                                                </View>
                                                <View>
                                                    <Text className={`text-base font-bold ${isSelected ? 'text-primary-700' : 'text-gray-800'}`}>
                                                        {item.nome}
                                                    </Text>
                                                    <Text className="text-gray-400 text-xs">
                                                        {jaFechou ? 'Já fechou o turno' : 'Toque para selecionar'}
                                                    </Text>
                                                </View>
                                            </View>
                                            {isSelected && (
                                                <View className="bg-primary-700 w-7 h-7 rounded-full items-center justify-center">
                                                    <Check size={16} color="white" strokeWidth={3} />
                                                </View>
                                            )}
                                            {!isSelected && jaFechou && (
                                                <View className="bg-green-500 w-7 h-7 rounded-full items-center justify-center">
                                                    <Check size={16} color="white" strokeWidth={3} />
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    </View>
                </Modal>

                {/* Seção do Encerrante (Destaque Principal) */}
                <View className="px-4 mt-6">
                    <View
                        className="bg-indigo-600 rounded-[32px] p-6 shadow-xl"
                        style={{ elevation: 8, shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20 }}
                    >
                        <View className="flex-row items-center gap-3 mb-4">
                            <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center border border-white/30">
                                <Gauge size={22} color="white" />
                            </View>
                            <View>
                                <Text className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Conferência de Vendas</Text>
                                <Text className="text-white text-lg font-black">Total Vendido (R$)</Text>
                            </View>
                        </View>

                        <View className="bg-white/10 rounded-2xl p-4 border border-white/20">
                            <View className="flex-row items-center">
                                <Text className="text-indigo-200 text-2xl font-bold mr-2">R$</Text>
                                <TextInput
                                    className="flex-1 text-3xl font-black text-white py-1"
                                    placeholder="0,00"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={registro.valorEncerrante}
                                    onChangeText={(text) => handleChange('valorEncerrante', text)}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Seção de Valores (Grid 2x2) */}
                <View className="px-4 mt-8">
                    <Text className="text-xl font-black text-gray-800 mb-1">💰 Recebimentos</Text>
                    <Text className="text-sm text-gray-500 mb-5">Toque nos campos para preencher os valores</Text>

                    <View className="flex-row flex-wrap -mx-2">
                        {/* Cartão Débito */}
                        <View className="w-1/2 px-2 mb-4">
                            <View className="bg-white rounded-3xl p-4 border-2 border-blue-50 shadow-sm">
                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="p-1.5 bg-blue-100 rounded-lg">
                                        <CreditCard size={16} color="#2563eb" />
                                    </View>
                                    <Text className="text-[10px] font-black text-blue-600 uppercase">Débito</Text>
                                </View>
                                <View className="flex-row items-center border-b border-gray-100 pb-1">
                                    <Text className="text-gray-400 font-bold mr-1">R$</Text>
                                    <TextInput
                                        className="flex-1 text-lg font-black text-gray-800 p-0"
                                        placeholder="0,00"
                                        value={registro.valorCartaoDebito}
                                        onChangeText={(v) => handleChange('valorCartaoDebito', v)}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Cartão Crédito */}
                        <View className="w-1/2 px-2 mb-4">
                            <View className="bg-white rounded-3xl p-4 border-2 border-indigo-50 shadow-sm">
                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="p-1.5 bg-indigo-100 rounded-lg">
                                        <CreditCard size={16} color="#4f46e5" />
                                    </View>
                                    <Text className="text-[10px] font-black text-indigo-600 uppercase">Crédito</Text>
                                </View>
                                <View className="flex-row items-center border-b border-gray-100 pb-1">
                                    <Text className="text-gray-400 font-bold mr-1">R$</Text>
                                    <TextInput
                                        className="flex-1 text-lg font-black text-gray-800 p-0"
                                        placeholder="0,00"
                                        value={registro.valorCartaoCredito}
                                        onChangeText={(v) => handleChange('valorCartaoCredito', v)}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* PIX */}
                        <View className="w-1/2 px-2 mb-4">
                            <View className="bg-white rounded-3xl p-4 border-2 border-teal-50 shadow-sm">
                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="p-1.5 bg-teal-100 rounded-lg">
                                        <Smartphone size={16} color="#0d9488" />
                                    </View>
                                    <Text className="text-[10px] font-black text-teal-600 uppercase">PIX</Text>
                                </View>
                                <View className="flex-row items-center border-b border-gray-100 pb-1">
                                    <Text className="text-gray-400 font-bold mr-1">R$</Text>
                                    <TextInput
                                        className="flex-1 text-lg font-black text-gray-800 p-0"
                                        placeholder="0,00"
                                        value={registro.valorPix}
                                        onChangeText={(v) => handleChange('valorPix', v)}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Dinheiro */}
                        <View className="w-1/2 px-2 mb-4">
                            <View className="bg-white rounded-3xl p-4 border-2 border-emerald-50 shadow-sm">
                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="p-1.5 bg-emerald-100 rounded-lg">
                                        <Banknote size={16} color="#059669" />
                                    </View>
                                    <Text className="text-[10px] font-black text-emerald-600 uppercase">Dinheiro</Text>
                                </View>
                                <View className="flex-row items-center border-b border-gray-100 pb-1">
                                    <Text className="text-gray-400 font-bold mr-1">R$</Text>
                                    <TextInput
                                        className="flex-1 text-lg font-black text-gray-800 p-0"
                                        placeholder="0,00"
                                        value={registro.valorDinheiro}
                                        onChangeText={(v) => handleChange('valorDinheiro', v)}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>
                        </View>

                        {/* Moedas */}
                        <View className="w-1/2 px-2 mb-4">
                            <View className="bg-white rounded-3xl p-4 border-2 border-amber-50 shadow-sm">
                                <View className="flex-row items-center gap-2 mb-2">
                                    <View className="p-1.5 bg-amber-100 rounded-lg">
                                        <Coins size={16} color="#d97706" />
                                    </View>
                                    <Text className="text-[10px] font-black text-amber-600 uppercase">Moedas</Text>
                                </View>
                                <View className="flex-row items-center border-b border-gray-100 pb-1">
                                    <Text className="text-gray-400 font-bold mr-1">R$</Text>
                                    <TextInput
                                        className="flex-1 text-lg font-black text-gray-800 p-0"
                                        placeholder="0,00"
                                        value={registro.valorMoedas}
                                        onChangeText={(v) => handleChange('valorMoedas', v)}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>
                        </View>
                    </View>


                    {/* Baratão (Full Width styled) */}
                    <View className="mb-6">
                        <View className="bg-rose-50 rounded-3xl p-5 border-2 border-rose-100 flex-row items-center justify-between">
                            <View className="flex-row items-center gap-4">
                                <View className="p-3 bg-rose-600 rounded-2xl shadow-md">
                                    <CircleDollarSign size={24} color="white" />
                                </View>
                                <View>
                                    <Text className="text-rose-700 font-black text-lg">Baratão</Text>
                                    <Text className="text-rose-400 text-xs">Voucher promocional</Text>
                                </View>
                            </View>
                            <View className="bg-white px-4 py-2 rounded-2xl border border-rose-200 flex-row items-center">
                                <Text className="text-rose-300 font-bold mr-1">R$</Text>
                                <TextInput
                                    className="text-xl font-black text-rose-700 min-w-[80px] text-right"
                                    placeholder="0,00"
                                    placeholderTextColor="#fecaca"
                                    value={registro.valorBaratao}
                                    onChangeText={(v) => handleChange('valorBaratao', v)}
                                    keyboardType="decimal-pad"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Seção de Notas/Vales */}
                    <View className="mb-4">
                        <View className="flex-row items-center justify-between mb-3 px-1">
                            <View>
                                <Text className="text-lg font-black text-gray-800">📑 Notas / Vales</Text>
                                <Text className="text-xs text-gray-400">Vendas faturadas a prazo</Text>
                            </View>
                            <TouchableOpacity
                                className="bg-cyan-600 px-4 py-2.5 rounded-2xl flex-row items-center gap-2 shadow-sm"
                                onPress={() => setModalNotaVisible(true)}
                            >
                                <Plus size={16} color="white" strokeWidth={3} />
                                <Text className="text-white font-black text-sm uppercase">Adicionar</Text>
                            </TouchableOpacity>
                        </View>

                        {notasAdicionadas.length === 0 ? (
                            <View className="bg-gray-100 rounded-[32px] p-10 border-2 border-gray-200 border-dashed items-center justify-center">
                                <View className="w-16 h-16 bg-gray-200 rounded-full items-center justify-center mb-4">
                                    <Receipt size={32} color="#9ca3af" />
                                </View>
                                <Text className="text-gray-400 text-sm font-bold text-center">Nenhuma nota pendente</Text>
                                <Text className="text-gray-300 text-[10px] uppercase mt-1 tracking-tighter">Toque em adicionar para registrar</Text>
                            </View>
                        ) : (
                            <View
                                className="bg-white rounded-[32px] border-2 border-cyan-100 overflow-hidden shadow-sm"
                                style={{ elevation: 3 }}
                            >
                                {notasAdicionadas.map((item, index) => (
                                    <View key={index} className={`flex-row items-center justify-between p-5 ${index !== notasAdicionadas.length - 1 ? 'border-b border-gray-50' : ''}`}>
                                        <View className="flex-1 pr-2">
                                            <Text className="text-gray-800 font-black text-base" numberOfLines={1}>{item.cliente_nome}</Text>
                                            <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">Venda faturada</Text>
                                        </View>
                                        <View className="flex-row items-center gap-4">
                                            <View className="bg-cyan-50 px-3 py-1.5 rounded-xl border border-cyan-100">
                                                <Text className="font-black text-cyan-700 text-base">{formatCurrency(item.valor_number)}</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => handleRemoveNota(index)}
                                                className="bg-red-50 p-2 rounded-xl border border-red-100"
                                            >
                                                <Trash2 size={18} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                                <View className="bg-cyan-600 p-5 flex-row justify-between items-center">
                                    <Text className="text-white font-black text-sm uppercase tracking-widest">Total em Notas</Text>
                                    <Text className="text-white font-black text-2xl">{formatCurrency(totalNotas)}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>



                {/* Card de Resumo */}
                <View className="px-4 mt-6">
                    <View
                        className="bg-white rounded-3xl border border-gray-100 overflow-hidden"
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }}
                    >
                        <View className="bg-gray-50 px-5 py-4 border-b border-gray-100">
                            <View className="flex-row items-center gap-2">
                                <Calculator size={20} color="#6b7280" />
                                <Text className="text-base font-bold text-gray-700">Resumo do Turno</Text>
                            </View>
                        </View>

                        <View className="p-5">
                            {/* Encerrante */}
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-gray-500">Encerrante</Text>
                                <Text className="text-lg font-bold text-purple-700">{formatCurrency(valorEncerrante)}</Text>
                            </View>

                            {/* Total Pagamentos */}
                            <View className="flex-row justify-between items-center mb-2">
                                <Text className="text-gray-500">Total Pagamentos</Text>
                                <Text className="text-lg font-bold text-gray-800">{formatCurrency(totalInformado)}</Text>
                            </View>

                            {/* Detalhamento de Pagamentos */}
                            <View className="pl-2 border-l-2 border-gray-100 mb-3">
                                {parseValue(registro.valorCartaoDebito) > 0 && (
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-gray-400 text-xs">Cartão Débito</Text>
                                        <Text className="text-xs font-medium text-gray-600">{formatCurrency(parseValue(registro.valorCartaoDebito))}</Text>
                                    </View>
                                )}
                                {parseValue(registro.valorCartaoCredito) > 0 && (
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-gray-400 text-xs">Cartão Crédito</Text>
                                        <Text className="text-xs font-medium text-gray-600">{formatCurrency(parseValue(registro.valorCartaoCredito))}</Text>
                                    </View>
                                )}
                                {totalNotas > 0 && (
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-gray-400 text-xs">Notas/Vales ({notasAdicionadas.length})</Text>
                                        <Text className="text-xs font-medium text-gray-600">{formatCurrency(totalNotas)}</Text>
                                    </View>
                                )}
                                {parseValue(registro.valorPix) > 0 && (
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-gray-400 text-xs">PIX</Text>
                                        <Text className="text-xs font-medium text-gray-600">{formatCurrency(parseValue(registro.valorPix))}</Text>
                                    </View>
                                )}
                                {parseValue(registro.valorDinheiro) > 0 && (
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-gray-400 text-xs">Dinheiro</Text>
                                        <Text className="text-xs font-medium text-gray-600">{formatCurrency(parseValue(registro.valorDinheiro))}</Text>
                                    </View>
                                )}
                                {parseValue(registro.valorMoedas) > 0 && (
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-gray-400 text-xs">Moedas</Text>
                                        <Text className="text-xs font-medium text-gray-600">{formatCurrency(parseValue(registro.valorMoedas))}</Text>
                                    </View>
                                )}
                                {parseValue(registro.valorBaratao) > 0 && (
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-gray-400 text-xs">Baratão</Text>
                                        <Text className="text-xs font-medium text-gray-600">{formatCurrency(parseValue(registro.valorBaratao))}</Text>
                                    </View>
                                )}
                            </View>

                            {/* Status da Diferença */}
                            <View className="border-t border-dashed border-gray-200 pt-3 mt-2">
                                {caixaBateu && (
                                    <View className="flex-row justify-between items-center py-2 px-3 bg-green-50 rounded-lg -mx-1">
                                        <View className="flex-row items-center gap-2">
                                            <Check size={18} color="#16a34a" />
                                            <Text className="text-green-700 font-bold">Caixa Bateu!</Text>
                                        </View>
                                        <Text className="text-lg font-black text-green-600">✓</Text>
                                    </View>
                                )}

                                {temFalta && (
                                    <View className="flex-row justify-between items-center py-2 px-3 bg-red-50 rounded-lg -mx-1">
                                        <View className="flex-row items-center gap-2">
                                            <AlertTriangle size={18} color="#dc2626" />
                                            <Text className="text-red-600 font-bold">Falta de Caixa</Text>
                                        </View>
                                        <Text className="text-lg font-black text-red-600">- {formatCurrency(diferencaCaixa)}</Text>
                                    </View>
                                )}

                                {temSobra && (
                                    <View className="flex-row justify-between items-center py-2 px-3 bg-yellow-50 rounded-lg -mx-1">
                                        <View className="flex-row items-center gap-2">
                                            <AlertTriangle size={18} color="#ca8a04" />
                                            <Text className="text-yellow-700 font-bold">Sobra de Caixa</Text>
                                        </View>
                                        <Text className="text-lg font-black text-yellow-600">+ {formatCurrency(Math.abs(diferencaCaixa))}</Text>
                                    </View>
                                )}

                                {valorEncerrante === 0 && (
                                    <View className="flex-row items-center gap-2 py-2">
                                        <Text className="text-gray-400 text-sm">Informe o encerrante para ver o status</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Botão Enviar */}
                <View className="px-4 mt-8" style={{ marginBottom: insets.bottom + 40 }}>
                    <TouchableOpacity
                        className={`w-full py-5 rounded-2xl flex-row items-center justify-center gap-3 ${submitting || totalInformado === 0 ? 'bg-gray-300' : 'bg-primary-700'}`}
                        style={totalInformado > 0 ? { shadowColor: '#b91c1c', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 10 } : {}}
                        onPress={handleSubmit}
                        disabled={submitting || totalInformado === 0}
                        activeOpacity={0.8}
                    >
                        {submitting ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <>
                                <Send size={22} color="#FFF" />
                                <Text className="text-white font-bold text-lg">Enviar Registro</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Modal de Adicionar Nota */}
            <Modal
                visible={modalNotaVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setModalNotaVisible(false)}
            >
                <View className="flex-1 bg-black/60 justify-end">
                    <TouchableOpacity
                        className="absolute inset-0"
                        onPress={() => setModalNotaVisible(false)}
                    />
                    <View className="bg-white rounded-t-[40px] p-6 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-2xl font-black text-gray-800">Nova Nota / Vale</Text>
                            <TouchableOpacity
                                onPress={() => setModalNotaVisible(false)}
                                className="bg-gray-100 p-2 rounded-full"
                            >
                                <X size={20} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-widest">Cliente</Text>

                        {/* Campo de Busca de Cliente */}
                        <View className="flex-row items-center bg-gray-50 rounded-2xl border border-gray-200 px-4 py-3 mb-4">
                            <Search size={20} color="#9ca3af" style={{ marginRight: 8 }} />
                            <TextInput
                                className="flex-1 text-base text-gray-800"
                                placeholder="Buscar cliente..."
                                placeholderTextColor="#9ca3af"
                                value={buscaCliente}
                                onChangeText={setBuscaCliente}
                                autoCapitalize="words"
                            />
                            {buscaCliente.length > 0 && (
                                <TouchableOpacity onPress={() => setBuscaCliente('')}>
                                    <X size={18} color="#9ca3af" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <View className="mb-6 h-64">
                            {clientes.length === 0 ? (
                                <View className="p-4 bg-gray-50 rounded-2xl items-center border border-gray-100">
                                    <Text className="text-gray-400 italic">Nenhum cliente cadastrado no sistema</Text>
                                </View>
                            ) : buscaCliente.length === 0 ? (
                                <View className="flex-1 items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 p-4">
                                    <Search size={32} color="#9ca3af" style={{ opacity: 0.5, marginBottom: 8 }} />
                                    <Text className="text-gray-400 text-center font-medium">Digite o nome para buscar...</Text>
                                </View>
                            ) : (
                                <ScrollView
                                    nestedScrollEnabled={true}
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={true}
                                    className="border border-gray-100 rounded-2xl bg-gray-50/50"
                                >
                                    <View className="p-2">
                                        {clientes.filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase())).length === 0 ? (
                                            <View className="p-4 items-center">
                                                <Text className="text-gray-400">Nenhum cliente encontrado</Text>
                                            </View>
                                        ) : (
                                            clientes
                                                .filter(c => c.nome.toLowerCase().includes(buscaCliente.toLowerCase()))
                                                .map((cliente) => (
                                                    <TouchableOpacity
                                                        key={cliente.id}
                                                        onPress={() => {
                                                            setSelectedCliente(cliente);
                                                            setBuscaCliente(''); // Limpa busca pra UX ficar top (ou não, dependendo, mas aqui fecha o modal depois né?)
                                                            // Ah, não, aqui só seleciona. Então talvez manter o texto ajude a confirmar. Mas vou limpar pra ficar clean.
                                                        }}
                                                        className={`px-4 py-3 rounded-xl border-2 mb-2 w-full flex-row justify-between items-center ${cliente.bloqueado ? 'bg-gray-200 border-gray-300 opacity-70' : selectedCliente?.id === cliente.id ? 'bg-cyan-600 border-cyan-600' : 'bg-white border-gray-200'}`}
                                                    >
                                                        <View className="flex-1">
                                                            <View className="flex-row items-center gap-2">
                                                                <Text className={`font-bold text-base ${cliente.bloqueado ? 'text-gray-500' : selectedCliente?.id === cliente.id ? 'text-white' : 'text-gray-800'}`}>
                                                                    {cliente.nome}
                                                                </Text>
                                                                {cliente.bloqueado && (
                                                                    <View className="bg-red-500 px-2 py-0.5 rounded">
                                                                        <Text className="text-white text-[10px] font-bold">BLOQUEADO</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            {cliente.documento && (
                                                                <Text className={`text-xs mt-0.5 ${cliente.bloqueado ? 'text-gray-400' : selectedCliente?.id === cliente.id ? 'text-cyan-100' : 'text-gray-400'}`}>
                                                                    {cliente.documento}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        {cliente.bloqueado ? (
                                                            <Ban size={20} color="#ef4444" />
                                                        ) : selectedCliente?.id === cliente.id ? (
                                                            <Check size={20} color="white" />
                                                        ) : null}
                                                    </TouchableOpacity>
                                                ))
                                        )}
                                    </View>
                                </ScrollView>
                            )}
                        </View>

                        <Text className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-widest">Valor da Nota</Text>
                        <View className="flex-row items-center bg-gray-50 rounded-3xl p-4 border-2 border-cyan-100 mb-8">
                            <Text className="text-2xl font-bold text-cyan-600 mr-2">R$</Text>
                            <TextInput
                                className="flex-1 text-3xl font-black text-gray-800"
                                placeholder="0,00"
                                value={valorNotaTemp}
                                onChangeText={(text) => setValorNotaTemp(formatCurrencyInput(text))}
                                keyboardType="numeric"
                            />
                        </View>

                        <TouchableOpacity
                            onPress={handleAddNota}
                            className={`py-4 rounded-3xl flex-row justify-center items-center shadow-lg ${!selectedCliente || parseValue(valorNotaTemp) === 0 ? 'bg-gray-300' : 'bg-cyan-600 shadow-cyan-200'}`}
                            disabled={!selectedCliente || parseValue(valorNotaTemp) === 0}
                        >
                            <Plus size={24} color="white" style={{ marginRight: 8 }} />
                            <Text className="text-white text-lg font-black">Adicionar Nota</Text>
                        </TouchableOpacity>
                        <View style={{ height: insets.bottom + 20 }} />
                    </View>
                </View>
            </Modal>

            {/* DatePicker para Android */}
            {showDatePicker && Platform.OS === 'android' && (
                <DateTimePicker
                    value={dataFechamento}
                    mode="date"
                    display="default"
                    onChange={handleDateChange}
                    maximumDate={new Date()} // Não permite selecionar datas futuras
                />
            )}

            {/* Modal com DatePicker para iOS */}
            <Modal
                visible={modalDataVisible && Platform.OS === 'ios'}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setModalDataVisible(false)}
            >
                <View className="flex-1 bg-black/60 justify-end">
                    <TouchableOpacity
                        className="absolute inset-0"
                        onPress={() => setModalDataVisible(false)}
                    />
                    <View className="bg-white rounded-t-[32px] p-6 shadow-2xl">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-2xl font-black text-gray-800">Selecionar Data</Text>
                            <TouchableOpacity
                                onPress={() => setModalDataVisible(false)}
                                className="bg-gray-100 p-2 rounded-full"
                            >
                                <X size={20} color="#6b7280" />
                            </TouchableOpacity>
                        </View>

                        <DateTimePicker
                            value={dataFechamento}
                            mode="date"
                            display="spinner"
                            onChange={handleDateChange}
                            maximumDate={new Date()}
                            textColor="#000"
                        />

                        <TouchableOpacity
                            onPress={() => setModalDataVisible(false)}
                            className="mt-4 bg-blue-600 py-4 rounded-2xl"
                        >
                            <Text className="text-white font-bold text-center text-lg">Confirmar</Text>
                        </TouchableOpacity>
                        <View style={{ height: insets.bottom + 10 }} />
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView >
    );
}
