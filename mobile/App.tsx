import './global.css'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ServiceApp } from '@/service-app'
import { UpdateGate } from '@/components/update-gate'

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <UpdateGate>
        <ServiceApp />
      </UpdateGate>
    </SafeAreaProvider>
  )
}
