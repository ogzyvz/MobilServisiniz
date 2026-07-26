// react-native-reanimated / react-native-worklets yalnızca NativeWind'in
// animasyon/geçiş (transition) özellikleri için gereklidir. Bu uygulamada hiçbir
// `transition-*` / `animate-*` sınıfı kullanılmadığından bu modüllerin JS'i asla
// çalıştırılmaz (css-interop yalnızca fonksiyon içinde lazy `require` eder).
//
// reanimated'ın C++ kaynak yolları CMake'in CMAKE_OBJECT_PATH_MAX (250) iç
// sınırını aştığı için Windows'ta native derlemesi başarısız olur. Kullanılmadığı
// için native (C++) derlemesini Android autolinking dışına alıyoruz.
module.exports = {
  dependencies: {
    'react-native-reanimated': {
      platforms: { android: null },
    },
    'react-native-worklets': {
      platforms: { android: null },
    },
  },
}
