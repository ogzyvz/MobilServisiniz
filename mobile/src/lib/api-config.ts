/** MobilServisiniz Web API adresi — sunucuda API 5280 portunda yayınlanmalıdır. */
import { Platform } from 'react-native'

const PRODUCTION_API = 'http://37.148.211.243:5280'

/** Android emülatörde localhost için 10.0.2.2 kullanılır. */
const DEV_ANDROID_API = 'http://10.0.2.2:5280'

export const API_BASE_URL =
  __DEV__ && Platform.OS === 'android' ? DEV_ANDROID_API : PRODUCTION_API
