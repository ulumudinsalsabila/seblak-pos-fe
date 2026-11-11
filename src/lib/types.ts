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
  inTransit?: { lines: number; value?: string };
  totalStockValue?: string;
  costCoverage: {
    complete: boolean;
    totalBalances: number;
    missingCosts: number;
  };
};
export type PurchaseReceipt = {
  id: string;
  supplierName: string;
  referenceNo?: string | null;
  notes?: string | null;
  totalAmount?: string;
  receivedAt: string;
  location: { id: string; name: string; code: string };
  createdBy?: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    inputQuantity: string;
    inputUnitPrice?: string;
    quantity: string;
    unitCost?: string;
    amount?: string;
    item: InventoryItem;
    unit: InventoryUnit;
  }>;
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
export type StockAdjustmentKind = "WASTE" | "ADJUSTMENT";
export type StockAdjustmentReason = "EXPIRED" | "SPOILED" | "SPILLED" | "DAMAGED" | "STAFF_MEAL" | "COUNT_CORRECTION" | "FOUND" | "OTHER" | "VOIDED_ORDER";
export type StockAdjustment = {
  id: string;
  kind: StockAdjustmentKind;
  reason: StockAdjustmentReason;
  notes?: string | null;
  /** Net stock value change: negative when stock went out. Absent without cost access, null when a line has no cost. */
  totalAmount?: string | null;
  occurredAt: string;
  location: { id: string; name: string; code: string };
  createdBy?: { id: string; name: string } | null;
  lines: Array<{
    id: string;
    direction: "IN" | "OUT";
    inputQuantity: string;
    quantity: string;
    unitCost?: string | null;
    amount?: string | null;
    item: InventoryItem;
    unit: InventoryUnit;
  }>;
};
export type StocktakeStatus = "COUNTING" | "REVIEW" | "POSTED" | "CANCELLED";
type Person = { id: string; name: string } | null;
export type Stocktake = {
  id: string;
  status: StocktakeStatus;
  notes?: string | null;
  createdAt: string;
  submittedAt?: string | null;
  postedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  location: { id: string; name: string; code: string };
  createdBy?: Person;
  submittedBy?: Person;
  approvedBy?: Person;
  cancelledBy?: Person;
  _count?: { lines: number };
  lines?: Array<{
    id: string;
    inputQuantity: string;
    countedQuantity: string;
    expectedQuantity: string;
    varianceQuantity: string;
    unitCost?: string | null;
    varianceAmount?: string | null;
    notes?: string | null;
    countedAt: string;
    item: InventoryItem;
    unit: InventoryUnit;
    countedBy?: Person;
  }>;
};
export type MenuOptionConsumptionRow = {
  id: string;
  groupId: string;
  valueId: string;
  quantity: string;
  location: { id: string; name: string; code: string };
  item: InventoryItem;
};
export type MenuOptionConsumptionGroup = {
  id: string;
  name: string;
  isActive: boolean;
  categoryIds: string[];
  values: Array<{ id: string; label: string; consumption: MenuOptionConsumptionRow[] }>;
};
export type PrepRecipe = {
  id: string;
  outputQuantity: string;
  notes?: string | null;
  lines: Array<{ id: string; quantity: string; item: InventoryItem }>;
};
export type PrepRecipeItem = InventoryItem & { recipe: PrepRecipe | null };
export type PrepBatchStatus = "IN_PROGRESS" | "COMPLETED" | "VOIDED";
export type PrepBatch = {
  id: string;
  status: PrepBatchStatus;
  plannedQuantity: string;
  actualQuantity?: string | null;
  /** Absent without cost access; null when an input had no cost. */
  inputCost?: string | null;
  outputUnitCost?: string | null;
  notes?: string | null;
  startedAt: string;
  completedAt?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  voidDisposition?: "RESTOCK" | "WASTE" | null;
  location: { id: string; name: string; code: string };
  outputItem: InventoryItem;
  startedBy?: { id: string; name: string } | null;
  completedBy?: { id: string; name: string } | null;
  voidedBy?: { id: string; name: string } | null;
  inputs: Array<{ id: string; quantity: string; unitCost?: string | null; amount?: string | null; item: InventoryItem }>;
};
type LocationRef = { id: string; name: string; code: string };
export type StockRequestStatus = "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "PARTIALLY_FULFILLED" | "FULFILLED";
export type StockRequest = {
  id: string;
  status: StockRequestStatus;
  notes?: string | null;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  sourceLocation: LocationRef;
  destinationLocation: LocationRef;
  requestedBy?: { id: string; name: string } | null;
  reviewedBy?: { id: string; name: string } | null;
  transfer?: { id: string; status: StockTransferStatus } | null;
  lines: Array<{ id: string; quantity: string; approvedQuantity?: string | null; item: InventoryItem }>;
};
export type StockTransferStatus = "APPROVED" | "SHIPPED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type StockTransfer = {
  id: string;
  status: StockTransferStatus;
  notes?: string | null;
  createdAt: string;
  shippedAt?: string | null;
  lastReceivedAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
  sourceLocation: LocationRef;
  destinationLocation: LocationRef;
  createdBy?: { id: string; name: string } | null;
  shippedBy?: { id: string; name: string } | null;
  closedBy?: { id: string; name: string } | null;
  request?: { id: string; status: StockRequestStatus } | null;
  lines: Array<{ id: string; quantity: string; shippedQuantity: string; receivedQuantity: string; lostQuantity: string; unitCost?: string | null; item: InventoryItem }>;
};
export type FoodCostReport = {
  period: { from: string; to: string; outletId: string | null };
  revenue: string;
  transactionCount: number;
  theoreticalCost: string;
  wasteCost: string;
  stocktakeCost: string;
  adjustmentCost: string;
  transferLossCost: string;
  actualCost: string;
  theoreticalFoodCostPercent: string | null;
  actualFoodCostPercent: string | null;
  purchaseSpend: string;
  purchaseCount: number;
  prep: { batches: number; yieldPercent: string | null; shrinkageCost: string };
  costCoverage: { uncostedMovements: number; complete: boolean };
  items: Array<{
    itemId: string;
    item: { id: string; name: string; sku: string; type: InventoryItem["type"]; baseUnit: { symbol: string; precision: number } } | null;
    salesQuantity: string;
    salesCost: string;
    wasteQuantity: string;
    wasteCost: string;
    stocktakeQuantity: string;
    stocktakeCost: string;
    adjustmentQuantity: string;
    adjustmentCost: string;
    lossCost: string;
    actualCost: string;
  }>;
};
type StockAlertRow = { itemId: string; name: string; sku: string; unit: string; location: string; quantity: string; reorderPoint: string };
export type InventoryAlerts = {
  generatedAt: string;
  outOfStock: StockAlertRow[];
  lowStock: StockAlertRow[];
  missingCost: number;
  staleTransfers: Array<{ id: string; shippedAt: string; sourceLocation: { name: string }; destinationLocation: { name: string } }>;
  staleBatches: Array<{ id: string; startedAt: string; outputItem: { name: string }; location: { name: string } }>;
  pendingApprovals: { requests: number; stocktakes: number; unshippedTransfers: number };
  priceAnomalies: Array<{ itemId: string; name: string; unit: string; changePercent: string; receivedAt: string; latestUnitCost?: string; previousUnitCost?: string }>;
};
