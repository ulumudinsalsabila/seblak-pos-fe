export type Role = "SUPER_ADMIN" | "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN";
export type User = {
  id: string;
  name?: string;
  email: string;
  role: Role;
  status?: "ACTIVE" | "INACTIVE";
  tenantId?: string | null;
  outletId?: string | null;
  outletName?: string | null;
};
export type OutletAccess = {
  role: Role;
  isDefault: boolean;
  outlet: { id: string; name: string; code: string; tenantId: string };
};
export type Category = {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
};
export type Product = {
  id: string;
  categoryId: string;
  name: string;
  sku: string;
  pricingType: "FIXED" | "PER_ITEM";
  price: number;
  /** HPP; omitted by the API for cashier/kitchen, null when not set. */
  unitCost?: number | null;
  stock: number | null;
  lowStockThreshold?: number | null;
  trackStock: boolean;
  imageUrl?: string;
  isActive: boolean;
  category: Category;
};
export type TransactionItem = {
  id: string;
  productName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  spicyLevel: number;
  brothLevel: "LITTLE" | "MEDIUM" | "MUCH";
  tastePreference: "SALTY" | "SAVORY" | "SWEET";
  notes?: string;
  selectedOptions?: SelectedMenuOption[];
  kitchenStatus: "PENDING" | "COMPLETED";
  completedAt?: string;
};
export type MenuOptionValue = { id: string; label: string; isDefault?: boolean };
export type MenuOptionGroup = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  categoryIds: string[];
  values: MenuOptionValue[];
};
export type SelectedMenuOption = {
  groupId: string;
  groupName: string;
  valueId: string;
  valueLabel: string;
};
export type Transaction = {
  id: string;
  invoiceNo: string;
  subtotal: number;
  discount: number;
  tax: number;
  taxPercentage: string;
  total: number;
  customerName: string;
  orderType: "DINE_IN" | "TAKEAWAY";
  spicyLevel: number;
  brothLevel: "LITTLE" | "MEDIUM" | "MUCH";
  tastePreference: "SALTY" | "SAVORY" | "SWEET";
  notes?: string;
  paymentMethod: "CASH" | "QRIS" | "TRANSFER";
  amountReceived?: number;
  changeAmount: number;
  status: "PAID" | "VOID";
  kitchenStatus: "PENDING" | "COMPLETED";
  kitchenCompletedAt?: string;
  createdAt: string;
  paidAt: string;
  voidReason?: string;
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptPaperSize: "MM58" | "MM80";
  cashier: { id: string; name: string };
  items: TransactionItem[];
};
export type Expense = {
  id: string;
  description: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  createdBy?: { id: string; name: string };
};
export type Settings = {
  id: string;
  storeName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  address?: string;
  phone?: string;
  currency: string;
  taxEnabled: boolean;
  taxPercentage: string | number;
  receiptHeader?: string;
  receiptFooter?: string;
  receiptPaperSize: "MM58" | "MM80";
  menuOptions: MenuOptionGroup[];
};
export type Branding = Pick<
  Settings,
  "storeName" | "logoUrl" | "faviconUrl" | "primaryColor"
> & {
  tenantId?: string;
  tenantName?: string;
  tenantSlug?: string;
};

export type TenantTheme = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  updatedAt: string | null;
};

export type InventoryUnit = {
  id: string;
  code: string;
  name: string;
  symbol: string;
  dimension: "MASS" | "VOLUME" | "COUNT";
  isBase: boolean;
  factorToDimensionBase: string;
  precision: number;
};
export type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  type: "INGREDIENT" | "SEMI_FINISHED" | "PACKAGED";
  reorderPoint: string;
  isActive: boolean;
  baseUnit: InventoryUnit;
  conversions?: ItemUnitConversion[];
  _count?: { conversions: number };
};
export type ItemUnitConversion = {
  id: string;
  mode: "SAME_DIMENSION" | "PACKAGING" | "DENSITY";
  factorToBase: string;
  density?: string | null;
  notes?: string | null;
  validFrom: string;
  validTo?: string | null;
  unit: InventoryUnit;
};
export type StockLocation = {
  id: string;
  code: string;
  name: string;
  type: "WAREHOUSE" | "OUTLET" | "KITCHEN" | "OTHER";
  isActive: boolean;
  outlet?: { id: string; name: string; code: string } | null;
};
export type StockBalance = {
  id: string;
  quantity: string;
  reservedQuantity: string;
  averageUnitCost?: string;
  updatedAt: string;
  item: InventoryItem;
  location: StockLocation;
};
export type InventoryOverview = {
  activeItems: number;
  activeLocations: number;
  outOfStock: number;
  lowStock: number;
  movementCount: number;
  totalStockValue?: string;
  costCoverage: {
    complete: boolean;
    totalBalances: number;
    missingCosts: number;
  };
};
export type StockMovement = {
  id: string;
  type: string;
  direction: "IN" | "OUT";
  quantity: string;
  unitCost?: string;
  amount?: string;
  balanceAfter: string;
  sourceType: string;
  sourceId?: string | null;
  notes?: string | null;
  occurredAt: string;
  createdAt: string;
  item: InventoryItem;
  location: StockLocation;
  actor?: { id: string; name: string } | null;
};
