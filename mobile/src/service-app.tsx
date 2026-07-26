import { useEffect, useMemo, useState } from 'react'

import { ActivityIndicator, Alert, BackHandler, Pressable, Text, View } from 'react-native'

import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Home, Car, Plus, Users, Package, Truck } from 'lucide-react-native'

import { cn } from '@/lib/utils'

import type {

  Complaint,

  Customer,

  ProductItem,

  ServiceItem,

  StockProduct,

  Supplier,

  Vehicle,

} from '@/lib/types'

import { colors } from '@/lib/theme'

import {

  initSession,

  clearSession,

  loadCustomers,

  loadStock,

  loadVehicles,

  loadServiceCatalog,

  loginUser,

  registerUser,

  createCustomer,

  updateCustomerApi,

  createStock,

  updateStockApi,

  createVehicleApi,

  transferVehicleApi,

  PlateConflictError,

  PhoneConflictError,

  refreshVehicle,

  setWorkOrderStatus,

  addComplaintApi,

  addServiceApi,

  updateServiceApi,

  deleteServiceApi,

  addPartApi,

  updatePartApi,

  deletePartApi,

  ensureCustomer,

  getCurrentUser,

  getStaffList,

  listSuppliers,

  createSupplier,

  returnPartToSupplier,

  updateComplaintApi,

  openNewVisit,

  type AuthResult,

  type ServiceCatalogItem,

  type CurrentUser,

  type StaffMember,

} from '@/lib/api'

import {

  SERVICE_CATEGORY_LABELS,

  type ServiceCatalogCategory,

  type ServiceCatalogItem as UiCatalogItem,

} from '@/lib/service-catalog'

import { Login } from '@/screens/login'

import { Dashboard } from '@/screens/dashboard'

import { VehicleList, type VehicleListFilter } from '@/screens/vehicle-list'

import { VehicleDetail } from '@/screens/vehicle-detail'

import { NewVehicleFlow } from '@/screens/new-vehicle-flow'

import { Customers } from '@/screens/customers'

import { CustomerDetail } from '@/screens/customer-detail'

import { Products } from '@/screens/products'

import { Suppliers } from '@/screens/suppliers'

import { SupplierReport } from '@/screens/supplier-report'



type View_ =
  | 'dashboard'
  | 'vehicles'
  | 'detail'
  | 'new'
  | 'customers'
  | 'products'
  | 'customerDetail'
  | 'suppliers'
  | 'supplierReport'

type IconType = typeof Home



function reportError(e: unknown) {

  console.warn('MobilServisiniz API hatası:', e)

  if (e instanceof PhoneConflictError) {

    Alert.alert('Uyarı', 'Bu telefon numarasıyla kayıtlı bir müşteri zaten var.')

    return

  }

  const msg = e instanceof Error ? e.message : 'İşlem başarısız.'

  Alert.alert('Hata', msg)

}



function toUiCatalog(items: ServiceCatalogItem[]): UiCatalogItem[] {

  return items.map((s) => ({

    name: s.name,

    price: s.defaultPrice,

    category: s.category as ServiceCatalogCategory,

  }))

}



export function ServiceApp() {

  const insets = useSafeAreaInsets()

  const [ready, setReady] = useState(false)

  const [user, setUser] = useState<string | null>(null)

  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  const [customers, setCustomers] = useState<Customer[]>([])

  const [stock, setStock] = useState<StockProduct[]>([])

  const [catalog, setCatalog] = useState<UiCatalogItem[]>([])

  const [view, setView] = useState<View_>('dashboard')

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  const [staff, setStaff] = useState<StaffMember[]>([])

  const [suppliers, setSuppliers] = useState<Supplier[]>([])

  const [vehicleListFilter, setVehicleListFilter] = useState<VehicleListFilter>('all')



  async function reloadAll() {

    const [v, c, s, cat, st, sup] = await Promise.all([

      loadVehicles(),

      loadCustomers(),

      loadStock(),

      loadServiceCatalog(),

      getStaffList(),

      listSuppliers(),

    ])

    setVehicles(v)

    setCustomers(c)

    setStock(s)

    setCatalog(toUiCatalog(cat))

    setStaff(st)

    setSuppliers(sup)

  }



  function reloadSuppliers() {

    listSuppliers().then(setSuppliers).catch(reportError)

  }



  useEffect(() => {

    let active = true

    ;(async () => {

      try {

        const saved = await initSession()

        if (!active) return

        if (saved) {

          setUser(saved)

          setCurrentUser(await getCurrentUser())

          await reloadAll()

        }

      } catch (e) {

        reportError(e)

      } finally {

        if (active) setReady(true)

      }

    })()

    return () => {

      active = false

    }

  }, [])



  // Android donanım geri tuşu: uygulamadan çıkmak yerine, o ekrandaki
  // "geri" butonuyla aynı hedefe döner (üst seviye görünüm geçmişi yoktur,
  // bu yüzden her iç görünüm ana/liste görünümüne döner).
  useEffect(() => {

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {

      if (view === 'detail') {

        setView('vehicles')

        return true

      }

      if (view === 'customerDetail') {

        setView('customers')

        return true

      }

      if (view === 'supplierReport') {

        setView('suppliers')

        return true

      }

      if (view === 'new') {

        setView('dashboard')

        return true

      }

      return false

    })

    return () => sub.remove()

  }, [view])



  const selected = useMemo(

    () => vehicles.find((v) => v.id === selectedId) ?? null,

    [vehicles, selectedId],

  )



  const selectedCustomer = useMemo(

    () => customers.find((c) => c.id === selectedCustomerId) ?? null,

    [customers, selectedCustomerId],

  )



  async function handleLogin(tenantCode: string, phone: string, password: string): Promise<AuthResult> {

    const res = await loginUser(tenantCode, phone, password)

    if (res.ok) {

      setUser(res.name)

      setCurrentUser(await getCurrentUser())

      try {

        await reloadAll()

      } catch (e) {

        reportError(e)

      }

    }

    return res

  }



  async function handleRegister(

    name: string,

    phone: string,

    password: string,

  ): Promise<AuthResult> {

    return registerUser()

  }



  function openVehicle(id: string) {

    setSelectedId(id)

    setView('detail')

  }



  function openVehicleList(filter: VehicleListFilter) {

    setVehicleListFilter(filter)

    setView('vehicles')

  }



  function openCustomer(customer: Customer) {

    setSelectedCustomerId(customer.id)

    setView('customerDetail')

  }



  async function replaceVehicle(updated: Vehicle) {

    setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))

  }



  async function withWo<T>(vehicleId: string, fn: (woId: string) => Promise<T>, reloadStock = false) {

    const v = vehicles.find((x) => x.id === vehicleId)

    if (!v?.workOrderId) throw new Error('İş emri bulunamadı.')

    setBusy(true)

    try {

      await fn(v.workOrderId)

      const fresh = await refreshVehicle(v.workOrderId)

      await replaceVehicle(fresh)

      if (reloadStock) {

        const s = await loadStock()

        setStock(s)

      }

    } finally {

      setBusy(false)

    }

  }



  async function addVehicle(vehicle: Vehicle) {

    setBusy(true)

    let resolvedCustomerId = vehicle.customer.id

    try {

      if (!customers.some((c) => c.id === resolvedCustomerId)) {

        const created = await ensureCustomer({

          name: vehicle.customer.name,

          phone: vehicle.customer.phone,

          address: vehicle.customer.address,

        })

        resolvedCustomerId = created.id

        setCustomers((prev) => [created, ...prev])

      }



      const created = await createVehicleApi(

        resolvedCustomerId,

        vehicle.plate,

        vehicle.brand,

        vehicle.model,

        vehicle.year,

        vehicle.color,

        vehicle.fuel,

        vehicle.chassis,

        vehicle.engineNo,

        vehicle.engineVolume,

        vehicle.km,

        vehicle.complaints[0]?.text,

      )

      setVehicles((prev) => [created, ...prev])

      setSelectedId(created.id)

      setView('detail')

    } catch (e) {

      // Plaka çakışması: müşteri bu akışta zaten oluşturulmuş olabilir (ensureCustomer),

      // bu yüzden çözülen müşteri id'sini hataya ekleyip NewVehicleFlow'un "Devret"

      // uyarısını göstermesi için yeniden fırlatıyoruz.

      if (e instanceof PlateConflictError) {

        e.resolvedCustomerId = resolvedCustomerId

        throw e

      }

      reportError(e)

    } finally {

      setBusy(false)

    }

  }



  async function transferVehicle(vehicleId: string, newCustomerId: string, complaint: string) {

    setBusy(true)

    try {

      const created = await transferVehicleApi(vehicleId, newCustomerId, complaint || undefined)

      setVehicles((prev) => [created, ...prev])

      setSelectedId(created.id)

      setView('detail')

    } catch (e) {

      reportError(e)

    } finally {

      setBusy(false)

    }

  }



  function addComplaint(id: string, text: string) {

    withWo(id, (woId) => addComplaintApi(woId, text)).catch(reportError)

  }



  function updateComplaint(id: string, complaintId: string, text: string) {

    withWo(id, (woId) => updateComplaintApi(woId, complaintId, text)).catch(reportError)

  }



  async function performLogout() {

    await clearSession()

    setUser(null)

    setCurrentUser(null)

    setVehicles([])

    setCustomers([])

    setStock([])

    setStaff([])

    setSuppliers([])

    setView('dashboard')

  }



  function handleLogout() {

    Alert.alert('Çıkış Yap', 'Çıkış yapmak istediğinize emin misiniz?', [

      { text: 'İptal', style: 'cancel' },

      { text: 'Çıkış Yap', style: 'destructive', onPress: () => performLogout() },

    ])

  }



  async function openNewVisitForVehicle(id: string, complaint?: string) {

    const v = vehicles.find((x) => x.id === id)

    if (!v) return

    setBusy(true)

    try {

      const fresh = await openNewVisit(v.id, complaint)

      await replaceVehicle(fresh)

      setSelectedId(fresh.id)

    } catch (e) {

      reportError(e)

    } finally {

      setBusy(false)

    }

  }



  function addService(id: string, service: Omit<ServiceItem, 'id'>, force?: boolean) {

    return withWo(id, (woId) => addServiceApi(woId, service, force))

  }



  function updateService(id: string, serviceId: string, data: Omit<ServiceItem, 'id'>) {

    withWo(id, (woId) => updateServiceApi(woId, serviceId, data)).catch(reportError)

  }



  function deleteService(id: string, serviceId: string) {

    withWo(id, (woId) => deleteServiceApi(woId, serviceId)).catch(reportError)

  }



  function addProduct(id: string, product: Omit<ProductItem, 'id'>, force?: boolean) {

    return withWo(id, (woId) => addPartApi(woId, product, force), true)

  }



  function updateProduct(id: string, productId: string, data: Omit<ProductItem, 'id'>) {

    withWo(id, (woId) => updatePartApi(woId, productId, data), true).catch(reportError)

  }



  function deleteProduct(id: string, productId: string) {

    withWo(id, (woId) => deletePartApi(woId, productId), true).catch(reportError)

  }



  function returnProductToSupplier(id: string, productId: string) {

    withWo(id, (woId) => returnPartToSupplier(woId, productId))

      .then(() => reloadSuppliers())

      .catch(reportError)

  }



  function setStatus(
    id: string,
    status: Vehicle['status'],
    assignment?: { assignedUserId?: string; assignedUserName?: string },
  ) {

    return withWo(id, (woId) => setWorkOrderStatus(woId, status, assignment))

  }



  function addCustomer(data: Omit<Customer, 'id'>) {

    setBusy(true)

    createCustomer(data)

      .then((c) => setCustomers((prev) => [c, ...prev]))

      .catch(reportError)

      .finally(() => setBusy(false))

  }



  function updateCustomer(id: string, data: Omit<Customer, 'id'>) {

    setBusy(true)

    updateCustomerApi(id, data)

      .then((c) => setCustomers((prev) => prev.map((x) => (x.id === id ? c : x))))

      .catch(reportError)

      .finally(() => setBusy(false))

  }



  function addStockItem(data: Omit<StockProduct, 'id'>) {

    setBusy(true)

    createStock(data)

      .then((p) => setStock((prev) => [p, ...prev]))

      .catch(reportError)

      .finally(() => setBusy(false))

  }



  function updateStockItem(id: string, data: Omit<StockProduct, 'id'>) {

    setBusy(true)

    updateStockApi(id, data)

      .then((p) => setStock((prev) => prev.map((x) => (x.id === id ? p : x))))

      .catch(reportError)

      .finally(() => setBusy(false))

  }



  function addSupplier(data: {

    name: string

    contact?: string

    phone?: string

    email?: string

    address?: string

    taxNo?: string

    openingBalance?: number

  }) {

    setBusy(true)

    createSupplier(data)

      .then((s) => setSuppliers((prev) => [s, ...prev]))

      .catch(reportError)

      .finally(() => setBusy(false))

  }



  if (!ready) {

    return (

      <View className="flex-1 items-center justify-center bg-background">

        <ActivityIndicator size="large" color={colors.primary} />

      </View>

    )

  }



  if (!user) {

    return <Login onLogin={handleLogin} onRegister={handleRegister} />

  }



  const navItems = [

    { key: 'dashboard' as const, label: 'Ana Sayfa', icon: Home },

    { key: 'vehicles' as const, label: 'Araçlar', icon: Car },

    { key: 'customers' as const, label: 'Müşteri', icon: Users },

    { key: 'products' as const, label: 'Stok', icon: Package },

    { key: 'suppliers' as const, label: 'Cariler', icon: Truck },

  ]



  const showNav =

    view !== 'new' &&

    view !== 'detail' &&

    view !== 'customerDetail' &&

    view !== 'supplierReport'



  return (

    <View className="flex-1 bg-background">

      {busy && (

        <View className="absolute inset-0 z-50 items-center justify-center bg-black/20">

          <ActivityIndicator size="large" color={colors.primary} />

        </View>

      )}

      <View className="flex-1">

        {view === 'dashboard' && (

          <Dashboard

            vehicles={vehicles}

            userName={user}

            currentUser={currentUser}

            onLogout={handleLogout}

            onOpenVehicle={openVehicle}

            onNewVehicle={() => setView('new')}

            onSeeAll={() => openVehicleList('all')}

            onFilterStatus={openVehicleList}

          />

        )}



        {view === 'vehicles' && (

          <VehicleList

            vehicles={vehicles}

            onOpenVehicle={openVehicle}

            onNewVehicle={() => setView('new')}

            initialFilter={vehicleListFilter}

          />

        )}



        {view === 'customers' && (

          <Customers

            customers={customers}

            onAdd={addCustomer}

            onUpdate={updateCustomer}

            onOpenCustomer={openCustomer}

          />

        )}



        {view === 'customerDetail' && selectedCustomer && (

          <CustomerDetail

            customer={selectedCustomer}

            onBack={() => setView('customers')}

            onUpdate={updateCustomer}

            onOpenVehicle={openVehicle}

          />

        )}



        {view === 'products' && (

          <Products products={stock} onAdd={addStockItem} onUpdate={updateStockItem} />

        )}



        {view === 'suppliers' && (

          <Suppliers

            suppliers={suppliers}

            onAdd={addSupplier}

            onChanged={reloadSuppliers}

            onOpenReport={() => setView('supplierReport')}

          />

        )}



        {view === 'supplierReport' && (

          <SupplierReport onBack={() => setView('suppliers')} />

        )}



        {view === 'detail' && selected && (

          <VehicleDetail

            vehicle={selected}

            serviceCatalog={catalog.length > 0 ? catalog : undefined}

            currentUser={currentUser}

            staff={staff}

            onBack={() => setView('vehicles')}

            onAddComplaint={(text) => addComplaint(selected.id, text)}

            onUpdateComplaint={(complaintId, text) => updateComplaint(selected.id, complaintId, text)}

            onAddService={(s, force) => addService(selected.id, s, force)}

            onUpdateService={(sid, s) => updateService(selected.id, sid, s)}

            onDeleteService={(sid) => deleteService(selected.id, sid)}

            onAddProduct={(p, force) => addProduct(selected.id, p, force)}

            onUpdateProduct={(pid, p) => updateProduct(selected.id, pid, p)}

            onDeleteProduct={(pid) => deleteProduct(selected.id, pid)}

            onReturnProductToSupplier={(pid) => returnProductToSupplier(selected.id, pid)}

            onSetStatus={(status, assignment) => setStatus(selected.id, status, assignment)}

            onOpenNewVisit={(complaint) => openNewVisitForVehicle(selected.id, complaint)}

          />

        )}



        {view === 'new' && (

          <NewVehicleFlow

            customers={customers}

            onCancel={() => setView('dashboard')}

            onComplete={addVehicle}

            onTransferConflict={transferVehicle}

          />

        )}

      </View>



      {showNav && (

        <View

          className="flex-row items-center justify-around border-t border-border bg-card px-2 pt-2"

          style={{ paddingBottom: insets.bottom + 8, ...navShadow }}

        >

          {navItems.slice(0, 2).map((item) => (

            <NavButton

              key={item.key}

              label={item.label}

              icon={item.icon}

              active={view === item.key}

              onPress={() => setView(item.key)}

            />

          ))}



          <Pressable onPress={() => setView('new')} className="items-center px-2">

            <View

              className="h-14 w-14 items-center justify-center rounded-2xl bg-accent border-4 border-background"

              style={{ transform: [{ translateY: -16 }], ...accentShadow }}

            >

              <Plus size={28} color={colors.accentForeground} strokeWidth={2.5} />

            </View>

            <Text className="text-xs font-semibold text-accent" style={{ marginTop: -8 }}>

              Yeni Kayıt

            </Text>

          </Pressable>



          {navItems.slice(2).map((item) => (

            <NavButton

              key={item.key}

              label={item.label}

              icon={item.icon}

              active={view === item.key}

              onPress={() => setView(item.key)}

            />

          ))}

        </View>

      )}

    </View>

  )

}



function NavButton({

  label,

  icon: Icon,

  active,

  onPress,

}: {

  label: string

  icon: IconType

  active: boolean

  onPress: () => void

}) {

  return (

    <Pressable

      onPress={onPress}

      className="min-w-14 items-center gap-1 rounded-xl px-2 py-2"

    >

      <Icon

        size={24}

        color={active ? colors.primary : colors.mutedForeground}

        strokeWidth={active ? 2.4 : 2}

      />

      <Text

        className={cn(

          'text-xs font-semibold',

          active ? 'text-primary' : 'text-muted-foreground',

        )}

      >

        {label}

      </Text>

    </Pressable>

  )

}



const navShadow = {

  shadowColor: '#000000',

  shadowOffset: { width: 0, height: -4 },

  shadowOpacity: 0.05,

  shadowRadius: 20,

  elevation: 12,

}



const accentShadow = {

  shadowColor: '#e07d33',

  shadowOffset: { width: 0, height: 6 },

  shadowOpacity: 0.4,

  shadowRadius: 12,

  elevation: 8,

}


