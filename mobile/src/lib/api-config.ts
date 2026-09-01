/** MobilServisiniz Web API adresi — IIS üzerinden domain ile yayınlanıyor. */
import { Platform } from 'react-native'

const PRODUCTION_API = 'https://api.mobilservisiniz.com'

/** Android emülatörde localhost için 10.0.2.2 kullanılır. */
const DEV_ANDROID_API = 'http://10.0.2.2:5280'

export const API_BASE_URL =
  __DEV__ && Platform.OS === 'android' ? DEV_ANDROID_API : PRODUCTION_API
