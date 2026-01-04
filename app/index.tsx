import { Redirect } from 'expo-router';

export default function Index() {
    // Redireciona automaticamente para a tela de registro (Modo sem Login)
    return <Redirect href="/(tabs)/registro" />;
}

