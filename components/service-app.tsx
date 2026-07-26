'use client'

import { useMemo, useState } from 'react'
import { Home, Car, Plus, Users, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { initialCustomers, initialStock, initialVehicles } from '@/lib/mock-data'
import type {
  Complaint,
  Customer,
  ProductItem,
  ServiceItem,
  StockProduct,
  Vehicle,
} from '@/lib/types'
import { Login } from '@/components/screens/login'
import { Dashboard } from '@/components/screens/dashboard'
import { VehicleList } from '@/components/screens/vehicle-list'
import { VehicleDetail } from '@/components/screens/vehicle-detail'
import { NewVehicleFlow } from '@/components/screens/new-vehicle-flow'
import { Customers } from '@/components/screens/customers'
import { Products } from '@/components/screens/products'

type View = 'dashboard' | 'vehicles' | 'detail' | 'new' | 'customers' | 'products'

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

export function ServiceApp() {
  const [user, setUser] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>(initialVehicles)
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)
  const [stock, setStock] = useState<StockProduct[]>(initialStock)
  const [view, setView] = useState<View>('dashboard')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedId) ?? null,
    [vehicles, selectedId],
  )

  function openVehicle(id: string) {
    setSelectedId(id)
    setView('detail')
  }

  function addVehicle(vehicle: Vehicle) {
    setVehicles((prev) => [vehicle, ...prev])
    // Araçla gelen müşteri kayıtlı değilse müşteri listesine ekle (ilişki senkron kalsın).
    setCustomers((prev) =>
      prev.some((c) => c.id === vehicle.customer.id)
        ? prev
        : [vehicle.customer, ...prev],
    )
    setSelectedId(vehicle.id)
    setView('detail')
  }

  function updateVehicle(id: string, updater: (v: Vehicle) => Vehicle) {
    setVehicles((prev) => prev.map((v) => (v.id === id ? updater(v) : v)))
  }

  function addComplaint(id: string, text: string) {
    const item: Complaint = { id: uid(), text, createdAt: new Date().toISOString() }
    updateVehicle(id, (v) => ({ ...v, complaints: [...v.complaints, item] }))
  }

  function addService(id: string, service: Omit<ServiceItem, 'id'>) {
    const item: ServiceItem = { id: uid(), ...service }
    updateVehicle(id, (v) => ({ ...v, services: [...v.services, item] }))
  }

  function updateService(id: string, serviceId: string, data: Omit<ServiceItem, 'id'>) {
    updateVehicle(id, (v) => ({
      ...v,
      services: v.services.map((s) => (s.id === serviceId ? { id: serviceId, ...data } : s)),
    }))
  }

  function deleteService(id: string, serviceId: string) {
    updateVehicle(id, (v) => ({
      ...v,
      services: v.services.filter((s) => s.id !== serviceId),
    }))
  }

  function addProduct(id: string, product: Omit<ProductItem, 'id'>) {
    const item: ProductItem = { id: uid(), ...product }
    updateVehicle(id, (v) => ({ ...v, products: [...v.products, item] }))
  }

  function updateProduct(id: string, productId: string, data: Omit<ProductItem, 'id'>) {
    updateVehicle(id, (v) => ({
      ...v,
      products: v.products.map((p) => (p.id === productId ? { id: productId, ...data } : p)),
    }))
  }

  function deleteProduct(id: string, productId: string) {
    updateVehicle(id, (v) => ({
      ...v,
      products: v.products.filter((p) => p.id !== productId),
    }))
  }

  function setStatus(id: string, status: Vehicle['status']) {
    updateVehicle(id, (v) => ({ ...v, status }))
  }

  function addCustomer(data: Omit<Customer, 'id'>) {
    setCustomers((prev) => [{ id: uid(), ...data }, ...prev])
  }

  function updateCustomer(id: string, data: Omit<Customer, 'id'>) {
    setCustomers((prev) => prev.map((c) => (c.id === id ? { id, ...data } : c)))
  }

  function addStock(data: Omit<StockProduct, 'id'>) {
    setStock((prev) => [{ id: uid(), ...data }, ...prev])
  }

  function updateStock(id: string, data: Omit<StockProduct, 'id'>) {
    setStock((prev) => prev.map((p) => (p.id === id ? { id, ...data } : p)))
  }

  if (!user) {
    return <Login onSuccess={setUser} />
  }

  const navItems = [
    { key: 'dashboard' as const, label: 'Ana Sayfa', icon: Home },
    { key: 'vehicles' as const, label: 'Araçlar', icon: Car },
    { key: 'customers' as const, label: 'Müşteri', icon: Users },
    { key: 'products' as const, label: 'Stok', icon: Package },
  ]

  const showNav = view !== 'new' && view !== 'detail'

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background">
      <main className="flex-1 pb-28">
        {view === 'dashboard' && (
          <Dashboard
            vehicles={vehicles}
            userName={user}
            onLogout={() => {
              setUser(null)
              setView('dashboard')
            }}
            onOpenVehicle={openVehicle}
            onNewVehicle={() => setView('new')}
            onSeeAll={() => setView('vehicles')}
          />
        )}

        {view === 'vehicles' && (
          <VehicleList
            vehicles={vehicles}
            onOpenVehicle={openVehicle}
            onNewVehicle={() => setView('new')}
          />
        )}

        {view === 'customers' && (
          <Customers
            customers={customers}
            onAdd={addCustomer}
            onUpdate={updateCustomer}
          />
        )}

        {view === 'products' && (
          <Products products={stock} onAdd={addStock} onUpdate={updateStock} />
        )}

        {view === 'detail' && selected && (
          <VehicleDetail
            vehicle={selected}
            onBack={() => setView('vehicles')}
            onAddComplaint={(text) => addComplaint(selected.id, text)}
            onAddService={(s) => addService(selected.id, s)}
            onUpdateService={(sid, s) => updateService(selected.id, sid, s)}
            onDeleteService={(sid) => deleteService(selected.id, sid)}
            onAddProduct={(p) => addProduct(selected.id, p)}
            onUpdateProduct={(pid, p) => updateProduct(selected.id, pid, p)}
            onDeleteProduct={(pid) => deleteProduct(selected.id, pid)}
            onSetStatus={(status) => setStatus(selected.id, status)}
          />
        )}

        {view === 'new' && (
          <NewVehicleFlow
            customers={customers}
            onCancel={() => setView('dashboard')}
            onComplete={addVehicle}
          />
        )}
      </main>

      {showNav && (
        <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md">
          <div className="relative flex items-center justify-around border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur">
            {navItems.slice(0, 2).map((item) => (
              <NavButton
                key={item.key}
                label={item.label}
                icon={item.icon}
                active={view === item.key}
                onClick={() => setView(item.key)}
              />
            ))}

            <button
              type="button"
              onClick={() => setView('new')}
              className="flex flex-col items-center gap-1 px-2"
              aria-label="Yeni araç kaydı"
            >
              <span className="flex size-14 -translate-y-4 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg shadow-accent/40 ring-4 ring-background">
                <Plus className="size-7" strokeWidth={2.5} />
              </span>
              <span className="-mt-2 text-xs font-semibold text-accent">
                Yeni Kayıt
              </span>
            </button>

            {navItems.slice(2).map((item) => (
              <NavButton
                key={item.key}
                label={item.label}
                icon={item.icon}
                active={view === item.key}
                onClick={() => setView(item.key)}
              />
            ))}
          </div>
        </nav>
      )}
    </div>
  )
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string
  icon: typeof Home
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
      {label}
    </button>
  )
}
