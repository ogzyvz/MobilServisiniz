import { type ReactNode, useEffect, useRef } from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useKeyboardHeight } from '@/lib/keyboard'

type Props = ScrollViewProps & {
  children: ReactNode
  /** Klavyesiz ek alt boşluk */
  basePaddingBottom?: number
  contentContainerStyle?: StyleProp<ViewStyle>
}

/**
 * ScrollView + klavye yüksekliği kadar alt boşluk.
 * Odaklanan alan klavyenin altında kalmasın diye içerik yukarı kaydırılabilir.
 */
export function KeyboardAwareScrollView({
  children,
  basePaddingBottom = 24,
  contentContainerStyle,
  ...rest
}: Props) {
  const kb = useKeyboardHeight()
  const ref = useRef<ScrollView>(null)
  const yRef = useRef(0)
  const prevKb = useRef(0)

  useEffect(() => {
    if (kb <= 0) {
      prevKb.current = 0
      return
    }
    // Sadece klavye yeni açıldığında kaydır (yeniden render'da tekrar tekrar zıplamasın)
    if (prevKb.current > 0) {
      prevKb.current = kb
      return
    }
    prevKb.current = kb
    const extra = Math.round(kb * 0.75)
    const t = setTimeout(() => {
      ref.current?.scrollTo({
        y: Math.max(0, yRef.current + extra),
        animated: true,
      })
    }, Platform.OS === 'ios' ? 50 : 120)
    return () => clearTimeout(t)
  }, [kb])

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    yRef.current = e.nativeEvent.contentOffset.y
    rest.onScroll?.(e)
  }

  const pad = basePaddingBottom + (kb > 0 ? kb + 24 : 0)

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      {...rest}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[contentContainerStyle, { paddingBottom: pad }]}
    >
      {children}
    </ScrollView>
  )
}
