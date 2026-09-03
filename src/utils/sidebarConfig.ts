import { t } from 'fyo';
import { routeFilters } from 'src/utils/filters';
import { fyo } from '../initFyo';
import { SidebarConfig, SidebarItem, SidebarRoot } from './types';

export function getSidebarConfig(): SidebarConfig {
  return getFilteredSidebar(getCompleteSidebar());
}

function getFilteredSidebar(sideBar: SidebarConfig): SidebarConfig {
  return sideBar.filter((root) => {
    root.items = root.items?.filter((item) => {
      if (item.hidden !== undefined) {
        return !item.hidden();
      }
      return true;
    });

    if (root.hidden !== undefined) {
      return !root.hidden();
    }
    return true;
  });
}

function getRegionalSidebar(): SidebarRoot[] {
  const hasGstin = !!fyo.singles?.AccountingSettings?.gstin;
  if (!hasGstin) {
    return [];
  }

  return [
    {
      label: t`Tax Desk`,
      name: 'gst',
      icon: 'gst',
      route: '/report/GSTR1',
      items: [
        { label: t`GSTR1 Return`, name: 'gstr1', route: '/report/GSTR1' },
        { label: t`GSTR2 Return`, name: 'gstr2', route: '/report/GSTR2' },
      ],
    },
  ];
}

function getInventorySidebar(): SidebarRoot[] {
  const hasInventory = !!fyo.singles.AccountingSettings?.enableInventory;
  if (!hasInventory) {
    return [];
  }

  return [
    {
      label: t`Stockroom`,
      name: 'inventory',
      icon: 'inventory',
      iconSize: '18',
      route: '/list/StockMovement',
      items: [
        {
          label: t`Inventory Transfers`,
          name: 'stock-movement',
          route: '/list/StockMovement',
          schemaName: 'StockMovement',
        },
        {
          label: t`Shipments`,
          name: 'shipment',
          route: '/list/Shipment',
          schemaName: 'Shipment',
        },
        {
          label: t`Goods Received`,
          name: 'purchase-receipt',
          route: '/list/PurchaseReceipt',
          schemaName: 'PurchaseReceipt',
        },
        { label: t`Movement History`, name: 'stock-ledger', route: '/report/StockLedger' },
        { label: t`Stock Snapshot`, name: 'stock-balance', route: '/report/StockBalance' },
      ],
    },
  ];
}

function getPOSSidebar() {
  return {
    label: t`Checkout`,
    name: 'pos',
    route: '/pos',
    icon: 'pos',
    hidden: () => !fyo.singles.InventorySettings?.enablePointOfSale,
  };
}

function getReportSidebar() {
  return {
    label: t`Insights`,
    name: 'reports',
    icon: 'reports',
    route: '/report/GeneralLedger',
    items: [
      { label: t`Account Activity`, name: 'general-ledger', route: '/report/GeneralLedger' },
      { label: t`Income vs Costs`, name: 'profit-and-loss', route: '/report/ProfitAndLoss' },
      { label: t`Financial Position`, name: 'balance-sheet', route: '/report/BalanceSheet' },
      { label: t`Balance Check`, name: 'trial-balance', route: '/report/TrialBalance' },
    ],
  };
}

function getCompleteSidebar(): SidebarConfig {
  return [
    {
      label: t`Launchpad`,
      name: 'get-started',
      route: '/get-started',
      icon: 'general',
      iconSize: '24',
      iconHeight: 5,
      hidden: () => !!fyo.singles.SystemSettings?.hideGetStarted,
    },
    {
      label: t`Overview`,
      name: 'dashboard',
      route: '/',
      icon: 'dashboard',
    },
    {
      label: t`Revenue`,
      name: 'sales',
      icon: 'sales',
      route: '/list/SalesInvoice',
      items: [
        {
          label: t`Estimates`,
          name: 'sales-quotes',
          route: '/list/SalesQuote',
          schemaName: 'SalesQuote',
        },
        {
          label: t`Customer Invoices`,
          name: 'sales-invoices',
          route: '/list/SalesInvoice',
          schemaName: 'SalesInvoice',
        },
        {
          label: t`Money Received`,
          name: 'payments',
          route: `/list/Payment/${t`Money Received`}`,
          schemaName: 'Payment',
          filters: routeFilters.SalesPayments,
        },
        {
          label: t`Customers`,
          name: 'customers',
          route: `/list/Party/${t`Customers`}`,
          schemaName: 'Party',
          filters: routeFilters.Customers,
        },
        {
          label: t`Products & Services`,
          name: 'sales-items',
          route: `/list/Item/${t`Products & Services`}`,
          schemaName: 'Item',
          filters: routeFilters.SalesItems,
        },
        {
          label: t`Rewards`,
          name: 'loyalty-program',
          route: '/list/LoyaltyProgram',
          schemaName: 'LoyaltyProgram',
          hidden: () => !fyo.singles.AccountingSettings?.enableLoyaltyProgram,
        },
        {
          label: t`Prospects`,
          name: 'lead',
          route: '/list/Lead',
          schemaName: 'Lead',
          hidden: () => !fyo.singles.AccountingSettings?.enableLead,
        },
        {
          label: t`Pricing Automation`,
          name: 'pricing-rule',
          route: '/list/PricingRule',
          schemaName: 'PricingRule',
          hidden: () => !fyo.singles.AccountingSettings?.enablePricingRule,
        },
        {
          label: t`Promo Codes`,
          name: 'coupon-code',
          route: '/list/CouponCode',
          schemaName: 'CouponCode',
          hidden: () => !fyo.singles.AccountingSettings?.enableCouponCode,
        },
      ] as SidebarItem[],
    },
    {
      label: t`Spending`,
      name: 'purchases',
      icon: 'purchase',
      route: '/list/PurchaseInvoice',
      items: [
        {
          label: t`Vendor Bills`,
          name: 'purchase-invoices',
          route: '/list/PurchaseInvoice',
          schemaName: 'PurchaseInvoice',
        },
        {
          label: t`Money Paid`,
          name: 'payments',
          route: `/list/Payment/${t`Money Paid`}`,
          schemaName: 'Payment',
          filters: routeFilters.PurchasePayments,
        },
        {
          label: t`Vendors`,
          name: 'suppliers',
          route: `/list/Party/${t`Vendors`}`,
          schemaName: 'Party',
          filters: routeFilters.Suppliers,
        },
        {
          label: t`Purchased Items`,
          name: 'purchase-items',
          route: `/list/Item/${t`Purchased Items`}`,
          schemaName: 'Item',
          filters: routeFilters.PurchaseItems,
        },
      ] as SidebarItem[],
    },
    {
      label: t`Ledger Hub`,
      name: 'common-entries',
      icon: 'common-entries',
      route: '/list/JournalEntry',
      items: [
        {
          label: t`Journal Records`,
          name: 'journal-entry',
          route: '/list/JournalEntry',
          schemaName: 'JournalEntry',
        },
        {
          label: t`Contacts`,
          name: 'party',
          route: '/list/Party',
          schemaName: 'Party',
          filters: { role: ['in', ['Customer', 'Supplier', 'Both']] },
        },
        {
          label: t`Shared Catalog`,
          name: 'common-items',
          route: `/list/Item/${t`Shared Catalog`}`,
          schemaName: 'Item',
          filters: { for: 'Both' },
        },
        {
          label: t`Rate Books`,
          name: 'price-list',
          route: '/list/PriceList',
          schemaName: 'PriceList',
          hidden: () => !fyo.singles.AccountingSettings?.enablePriceList,
        },
      ] as SidebarItem[],
    },
    getReportSidebar(),
    getInventorySidebar(),
    getPOSSidebar(),
    getRegionalSidebar(),
    {
      label: t`Control Center`,
      name: 'setup',
      icon: 'settings',
      route: '/chart-of-accounts',
      items: [
        { label: t`Account Structure`, name: 'chart-of-accounts', route: '/chart-of-accounts' },
        { label: t`Tax Rules`, name: 'taxes', route: '/list/Tax', schemaName: 'Tax' },
        { label: t`Bring In Data`, name: 'import-wizard', route: '/import-wizard' },
        { label: t`Document Layouts`, name: 'print-template', route: `/list/PrintTemplate/${t`Document Layouts`}` },
        {
          label: t`Field Designer`,
          name: 'customize-form',
          route: `/list/CustomForm/${t`Field Designer`}`,
          hidden: () => !fyo.singles.AccountingSettings?.enableFormCustomization,
        },
        { label: t`Preferences`, name: 'settings', route: '/settings' },
      ] as SidebarItem[],
    },
  ].flat();
}
