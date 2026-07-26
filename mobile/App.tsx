import './global.css'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ServiceApp } from '@/service-app'

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ServiceApp />
    </SafeAreaProvider>
  )
}
