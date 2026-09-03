<template>
  <div class="h-full flex flex-col arthivox-dashboard-page" style="width: var(--w-desk)">
    <div class="arthivox-dashboard-head flex-shrink-0">
      <div class="flex items-start justify-between gap-6">
        <div>
          <p class="arthivox-kicker">{{ t`Finance cockpit` }}</p>
          <h1 class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white mt-1">
            {{ t`Overview` }}
          </h1>
          <p class="text-sm arthivox-muted mt-2 max-w-xl">
            {{ t`Follow cash movement, open invoices, operating result and spending from one workspace.` }}
          </p>
        </div>
        <div class="arthivox-period-panel">
          <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ t`Reporting window` }}</p>
          <PeriodSelector
            :value="period"
            :options="['This Year', 'This Quarter', 'This Month', 'YTD']"
            @change="(value) => (period = value)"
          />
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-auto no-scrollbar px-5 pb-5">
      <div class="arthivox-dashboard-layout">
        <section class="arthivox-dashboard-card arthivox-flow-zone">
          <div class="arthivox-card-label-row">
            <span class="arthivox-card-index">01</span>
            <span>{{ t`Liquidity` }}</span>
          </div>
          <Cashflow
            class="p-5 pt-3"
            :common-period="period"
            :dark-mode="darkMode"
            @period-change="handlePeriodChange"
          />
        </section>

        <aside class="arthivox-dashboard-stack">
          <div class="arthivox-dashboard-card arthivox-mini-panel">
            <div class="arthivox-card-label-row px-4 pt-4">
              <span class="arthivox-card-index">02</span>
              <span>{{ t`Receivables` }}</span>
            </div>
            <UnpaidInvoices
              :schema-name="'SalesInvoice'"
              :common-period="period"
              :dark-mode="darkMode"
              @period-change="handlePeriodChange"
            />
          </div>

          <div class="arthivox-dashboard-card arthivox-mini-panel">
            <div class="arthivox-card-label-row px-4 pt-4">
              <span class="arthivox-card-index">03</span>
              <span>{{ t`Payables` }}</span>
            </div>
            <UnpaidInvoices
              :schema-name="'PurchaseInvoice'"
              :common-period="period"
              :dark-mode="darkMode"
              @period-change="handlePeriodChange"
            />
          </div>
        </aside>

        <section class="arthivox-dashboard-card arthivox-cost-zone">
          <div class="arthivox-card-label-row">
            <span class="arthivox-card-index">04</span>
            <span>{{ t`Cost profile` }}</span>
          </div>
          <Expenses
            class="p-5 pt-3"
            :common-period="period"
            :dark-mode="darkMode"
            @period-change="handlePeriodChange"
          />
        </section>

        <section class="arthivox-dashboard-card arthivox-result-zone">
          <div class="arthivox-card-label-row">
            <span class="arthivox-card-index">05</span>
            <span>{{ t`Operating result` }}</span>
          </div>
          <ProfitAndLoss
            class="p-5 pt-3"
            :common-period="period"
            :dark-mode="darkMode"
            @period-change="handlePeriodChange"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<script>
import Cashflow from './Cashflow.vue';
import Expenses from './Expenses.vue';
import PeriodSelector from './PeriodSelector.vue';
import ProfitAndLoss from './ProfitAndLoss.vue';
import UnpaidInvoices from './UnpaidInvoices.vue';
import { docsPathRef } from 'src/utils/refs';

export default {
  name: 'Dashboard',
  components: {
    Cashflow,
    ProfitAndLoss,
    Expenses,
    PeriodSelector,
    UnpaidInvoices,
  },
  props: {
    darkMode: { type: Boolean, default: false },
  },
  data() {
    return { period: 'This Year' };
  },
  activated() {
    docsPathRef.value = 'books/dashboard';
  },
  deactivated() {
    docsPathRef.value = '';
  },
  methods: {
    handlePeriodChange(period) {
      if (period === this.period) {
        return;
      }
      this.period = '';
    },
  },
};
</script>
