import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { frentistaService, type Frentista, type Posto } from './api';

interface PostoContextType {
    postoAtivo: Posto | null;
    postoAtivoId: number | null;
    loading: boolean;
    error: string | null;
    refreshPosto: () => Promise<void>;
}

const PostoContext = createContext<PostoContextType | undefined>(undefined);

export const PostoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [postoAtivo, setPostoAtivo] = useState<Posto | null>(null);
    const [postoAtivoId, setPostoAtivoId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadPostoData = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                // MODO UNIVERSAL: Se não tem login, usamos o posto padrão (ID 1 ou primeiro encontrado)
                console.log('[PostoContext] Sem usuário logado - Carregando posto padrão no Modo Universal');

                // Tenta pegar o posto ID 1 (padrão) ou o primeiro ativo
                const { data: posto, error: postoError } = await supabase
                    .from('Posto')
                    .select('*')
                    .eq('ativo', true)
                    .limit(1)
                    .single();

                if (postoError || !posto) {
                    setError('Nenhum posto ativo encontrado para o modo universal.');
                    setPostoAtivo(null);
                    setPostoAtivoId(null);
                } else {
                    setPostoAtivo(posto);
                    setPostoAtivoId(posto.id);
                }

                setLoading(false);
                return;
            }

            // Buscar frentista para obter o posto_id (Caminho Logado Legacy)
            const frentista = await frentistaService.getByUserId(session.user.id);

            if (frentista && frentista.posto_id) {
                setPostoAtivoId(frentista.posto_id);

                // Buscar detalhes do posto
                const { data: posto, error: postoError } = await supabase
                    .from('Posto')
                    .select('*')
                    .eq('id', frentista.posto_id)
                    .single();

                if (postoError) throw postoError;
                setPostoAtivo(posto);
            } else {
                // Se está logado mas sem frentista, tenta fallback para posto padrão também
                // para evitar tela branca/erro
                const { data: postoDefault } = await supabase
                    .from('Posto')
                    .select('*')
                    .eq('ativo', true)
                    .limit(1)
                    .single();

                if (postoDefault) {
                    setPostoAtivo(postoDefault);
                    setPostoAtivoId(postoDefault.id);
                } else {
                    setError('Frentista não vinculado a um posto ativo.');
                }
            }
        } catch (err: any) {
            console.error('Erro ao carregar dados do posto:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPostoData();

        // Escutar mudanças na autenticação
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                loadPostoData();
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const value = {
        postoAtivo,
        postoAtivoId,
        loading,
        error,
        refreshPosto: loadPostoData
    };

    return (
        <PostoContext.Provider value={value}>
            {children}
        </PostoContext.Provider>
    );
};

export const usePosto = () => {
    const context = useContext(PostoContext);
    if (context === undefined) {
        throw new Error('usePosto deve ser usado dentro de um PostoProvider');
    }
    return context;
};
