import { t } from 'fyo';
import { ModelNameEnum } from 'models/types';
import { openSettings, routeTo } from './ui';
import { GetStartedConfigItem } from './types';

export function getGetStartedConfig(): GetStartedConfigItem[] {
  /* eslint-disable @typescript-eslint/no-misused-promises */
  return [
    {
      label: t`Workspace Identity`,
      items: [
        {
          key: 'General',
          label: t`Business Profile`,
          icon: 'general',
          description: t`Add the business name, contact details, country and financial year used across your records.`,
          fieldname: 'companySetup',
          action: () => openSettings(ModelNameEnum.AccountingSettings),
        },
        {
          key: 'Print',
          label: t`Document Branding`,
          icon: 'invoice',
          description: t`Prepare the logo, address and presentation used on customer-facing documents.`,
          fieldname: 'printSetup',
          action: () => openSettings(ModelNameEnum.PrintSettings),
        },
        {
          key: 'System',
          label: t`Workspace Preferences`,
          icon: 'system',
          description: t`Choose date, number and display preferences for your ArthivoX workspace.`,
          fieldname: 'systemSetup',
          action: () => openSettings(ModelNameEnum.SystemSettings),
        },
      ],
    },
    {
      label: t`Financial Foundation`,
      items: [
        {
          key: 'Review Accounts',
          label: t`Account Structure`,
          icon: 'review-ac',
          description: t`Review the account structure and add the financial categories your business needs.`,
          action: () => routeTo('/chart-of-accounts'),
          fieldname: 'chartOfAccountsReviewed',
        },
        {
          key: 'Opening Balances',
          label: t`Starting Balances`,
          icon: 'opening-ac',
          fieldname: 'openingBalanceChecked',
          description: t`Confirm starting balances before entering day-to-day transactions.`,
        },
        {
          key: 'Add Taxes',
          label: t`Tax Rules`,
          icon: 'percentage',
          fieldname: 'taxesAdded',
          description: t`Create reusable tax rules for income and spending records.`,
          action: () => routeTo('/list/Tax'),
        },
      ],
    },
    {
      label: t`Revenue Workflow`,
      items: [
        {
          key: 'Add Sales Items',
          label: t`Build Your Catalog`,
          icon: 'item',
          description: t`Add the products or services you provide to customers.`,
          action: () =>
            routeTo({
              path: `/list/Item/${t`Products & Services`}`,
              query: { filters: JSON.stringify({ for: 'Sales' }) },
            }),
          fieldname: 'salesItemCreated',
        },
        {
          key: 'Add Customers',
          label: t`Add Customer Contacts`,
          icon: 'customer',
          description: t`Create customer contacts so revenue records can be issued correctly.`,
          action: () =>
            routeTo({
              path: `/list/Party/${t`Customers`}`,
              query: { filters: JSON.stringify({ role: 'Customer' }) },
            }),
          fieldname: 'customerCreated',
        },
        {
          key: 'Create Sales Invoice',
          label: t`Issue a Customer Invoice`,
          icon: 'sales-invoice',
          description: t`Create a first customer invoice to validate your revenue workflow.`,
          action: () => routeTo('/list/SalesInvoice'),
          fieldname: 'invoiceCreated',
        },
      ],
    },
    {
      label: t`Spending Workflow`,
      items: [
        {
          key: 'Add Purchase Items',
          label: t`Add Purchased Items`,
          icon: 'item',
          description: t`Add products or services purchased from vendors.`,
          action: () =>
            routeTo({
              path: `/list/Item/${t`Purchased Items`}`,
              query: { filters: JSON.stringify({ for: 'Purchases' }) },
            }),
          fieldname: 'purchaseItemCreated',
        },
        {
          key: 'Add Suppliers',
          label: t`Add Vendor Contacts`,
          icon: 'supplier',
          description: t`Create vendor contacts for bills, payments and purchasing history.`,
          action: () =>
            routeTo({
              path: `/list/Party/${t`Vendors`}`,
              query: { filters: JSON.stringify({ role: 'Supplier' }) },
            }),
          fieldname: 'supplierCreated',
        },
        {
          key: 'Create Purchase Invoice',
          label: t`Enter a Vendor Bill`,
          icon: 'purchase-invoice',
          description: t`Create a first vendor bill to validate your spending workflow.`,
          action: () => routeTo('/list/PurchaseInvoice'),
          fieldname: 'billCreated',
        },
      ],
    },
  ];
}
