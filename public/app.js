const state = {
  user: null,
  stores: [],
  products: [],
  inventory: [],
  orders: [],
  settlements: [],
  stats: null,
  draft: {},
  adminDetail: 'products',
  historyDateFrom: '',
  historyDateTo: '',
  historyStoreId: '',
  productDateFrom: '',
  productDateTo: '',
  statsDateFrom: '',
  statsDateTo: '',
}

const $ = (selector) => document.querySelector(selector)
const money = (value) => `${Number(value).toLocaleString('ko-KR')}원`

const navByRole = {
  store: [
    { id: 'dashboard', label: '대시보드' },
    { id: 'order', label: '발주' },
    { id: 'inventory', label: '재고' },
    { id: 'admin', label: '내역' },
  ],
  admin: [
    { id: 'dashboard', label: '관리' },
    { id: 'admin', label: '승인' },
    { id: 'inventory', label: '재고' },
    { id: 'stats', label: '통계' },
    { id: 'prices', label: '단가' },
  ],
}

const els = {
  loginScreen: $('#loginScreen'),
  appShell: $('#appShell'),
  currentUser: $('#currentUser'),
  roleLabel: $('#roleLabel'),
  loginName: $('#loginName'),
  loginPassword: $('#loginPassword'),
  navMenu: $('#navMenu'),
  workspaceEyebrow: $('#workspaceEyebrow'),
  workspaceTitle: $('#workspaceTitle'),
  todayPill: $('#todayPill'),
  dashboardTitle: $('#dashboardTitle'),
  dashboardDesc: $('#dashboardDesc'),
  dashboardPrimaryTitle: $('#dashboardPrimaryTitle'),
  dashboardPrimaryAction: $('#dashboardPrimaryAction'),
  dashboardSecondaryTitle: $('#dashboardSecondaryTitle'),
  dashboardSecondaryAction: $('#dashboardSecondaryAction'),
  adminDetailTabs: $('#adminDetailTabs'),
  inventoryTitle: $('#inventoryTitle'),
  inventoryDesc: $('#inventoryDesc'),
  adminTitle: $('#adminTitle'),
  adminDesc: $('#adminDesc'),
  adminListTitle: $('#adminListTitle'),
  orderCount: $('#orderCount'),
  pendingCount: $('#pendingCount'),
  lowStockCount: $('#lowStockCount'),
  totalAmount: $('#totalAmount'),
  recentOrders: $('#recentOrders'),
  lowStockList: $('#lowStockList'),
  orderStore: $('#orderStore'),
  inventoryStore: $('#inventoryStore'),
  productList: $('#productList'),
  orderMemo: $('#orderMemo'),
  draftTotal: $('#draftTotal'),
  inventoryList: $('#inventoryList'),
  adminOrders: $('#adminOrders'),
  storeStats: $('#storeStats'),
  priceList: $('#priceList'),
  toast: $('#toast'),
}

function showToast(message) {
  els.toast.textContent = message
  els.toast.classList.add('show')
  setTimeout(() => els.toast.classList.remove('show'), 1800)
}

function statusLabel(status) {
  if (status === 'approved') return ['승인', 'done']
  if (status === 'rejected') return ['반려', 'reject']
  return ['대기', 'wait']
}

function orderProgressLabel(status) {
  if (status === 'approved') return ['완료', 'done']
  if (status === 'rejected') return ['반려', 'reject']
  return ['대기중', 'wait']
}

function orderDateValue(order) {
  const match = String(order.createdAt).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/)
  if (!match) return ''
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function currentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate()
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  }
}

function currentMonthValue() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function orderMonthValue(order) {
  return orderDateValue(order).slice(0, 7)
}

function monthValueFromDate(dateValue) {
  return String(dateValue || '').slice(0, 7)
}

function settlementDateValue(settlement) {
  if (settlement.date) return settlement.date
  if (settlement.month) return `${settlement.month}-01`
  return ''
}

function ensureProductDateRange() {
  if (state.productDateFrom && state.productDateTo) return
  const range = currentMonthRange()
  state.productDateFrom ||= range.from
  state.productDateTo ||= range.to
}

function visibleOrders() {
  if (state.user?.role === 'store') {
    return state.orders.filter((order) => order.storeId === state.user.storeId)
  }
  return state.orders
}

function visibleInventory() {
  if (state.user?.role === 'store') {
    return state.inventory.filter((row) => row.storeId === state.user.storeId)
  }
  return state.inventory
}

function setView(viewId) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === viewId)
  })
  document.querySelectorAll('.nav-button').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === viewId)
  })
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || '요청 처리 중 오류가 발생했습니다.')
  return result
}

async function loadData() {
  const data = await api('/api/bootstrap')
  state.stores = data.stores
  state.products = data.products
  state.inventory = data.inventory
  state.orders = data.orders
  state.settlements = data.settlements || []
  state.stats = data.stats
  renderAll()
}

function renderRoleShell() {
  const roleName = state.user.role === 'admin' ? '관리자' : '매장'
  els.appShell.classList.toggle('role-admin', state.user.role === 'admin')
  els.appShell.classList.toggle('role-store', state.user.role === 'store')
  els.adminDetailTabs.classList.remove('hidden')
  els.currentUser.textContent = state.user.name
  els.roleLabel.textContent = roleName
  els.workspaceEyebrow.textContent =
    state.user.role === 'admin' ? '관리자 창' : 'Store Workspace'
  els.workspaceTitle.textContent =
    state.user.role === 'admin' ? '관리자 창' : '매장 전용 화면'
  els.todayPill.textContent = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  els.dashboardTitle.textContent =
    state.user.role === 'admin' ? '' : '매장 대시보드'
  els.dashboardDesc.textContent =
    state.user.role === 'admin'
      ? '전체 매장의 발주 대기, 부족 재고, 발주 수량을 확인합니다.'
      : '우리 매장의 발주 대기와 부족 재고를 빠르게 확인합니다.'
  els.inventoryTitle.textContent =
    state.user.role === 'admin' ? '전체 재고 관리' : '매장 재고 현황'
  els.inventoryDesc.textContent =
    state.user.role === 'admin'
      ? '매장별 재고와 안전 재고를 수정합니다.'
      : '우리 매장의 현재 수량과 안전 재고를 확인합니다.'
  els.adminTitle.textContent =
    state.user.role === 'admin' ? '발주 승인 관리' : '내 발주 내역'
  els.adminDesc.textContent =
    state.user.role === 'admin'
      ? '매장에서 요청한 발주를 승인 또는 반려합니다.'
      : '내가 요청한 발주 상태를 확인합니다.'
  els.adminListTitle.textContent =
    state.user.role === 'admin' ? '승인 대기 및 처리 내역' : '내 발주 목록'
  els.dashboardPrimaryTitle.textContent =
    state.user.role === 'admin' ? '전체 발주 내역' : '최근 발주'
  els.dashboardPrimaryAction.textContent =
    state.user.role === 'admin' ? '승인 관리' : '발주 보기'
  els.dashboardPrimaryAction.dataset.jump = 'admin'
  els.dashboardSecondaryTitle.textContent =
    state.user.role === 'admin' ? '매장별 발주 내역' : '부족 품목'
  els.dashboardSecondaryAction.textContent =
    state.user.role === 'admin' ? 'CSV 다운로드' : '재고 보기'
  els.dashboardSecondaryAction.dataset.jump = state.user.role === 'admin' ? '' : 'inventory'
  els.dashboardSecondaryAction.classList.toggle('hidden', state.user.role === 'admin')
  const detailButtons = els.adminDetailTabs.querySelectorAll('[data-admin-detail]')
  detailButtons[0].textContent = state.user.role === 'admin' ? '전체 발주' : '최근 발주'
  detailButtons[1].textContent = state.user.role === 'admin' ? '매장별' : '부족 품목'
  detailButtons[2].textContent = '조회'
  detailButtons[2].classList.toggle('hidden', state.user.role !== 'admin')
  updateAdminDetailTabs()

  els.navMenu.innerHTML = navByRole[state.user.role]
    .map(
      (item, index) => `
        <button class="nav-button ${index === 0 ? 'active' : ''}" type="button" data-view="${item.id}">
          ${item.label}
        </button>
      `,
    )
    .join('')

  els.navMenu.querySelectorAll('.nav-button').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view))
  })
}

function updateAdminDetailTabs() {
  document.querySelectorAll('[data-admin-detail]').forEach((button) => {
    button.classList.toggle('active', button.dataset.adminDetail === state.adminDetail)
  })
}

function aggregateByProduct(orders) {
  const rows = new Map()
  orders.forEach((order) => {
    approvedDetails(order).forEach((detail) => {
      const current = rows.get(detail.productId) || {
        productId: detail.productId,
        productName: detail.productName,
        category: detail.category,
        unit: detail.unit,
        quantity: 0,
        orderCount: 0,
      }
      current.quantity += detail.quantity
      current.orderCount += 1
      rows.set(detail.productId, current)
    })
  })

  return [...rows.values()].sort((a, b) => b.quantity - a.quantity)
}

function aggregateByStore(orders) {
  return state.stores.map((store) => {
    const storeOrders = orders
      .filter((order) => order.storeId === store.id)
      .sort((a, b) => b.id - a.id)
    const productRows = aggregateByProduct(storeOrders)
    return {
      store,
      orderCount: storeOrders.length,
      total: storeOrders.reduce((sum, order) => sum + approvedQuantity(order), 0),
      productRows,
      orders: storeOrders,
    }
  })
}

function groupRowsByCategory(rows) {
  return rows.reduce((groups, row) => {
    const key = row.category || '기타'
    if (!groups[key]) groups[key] = []
    groups[key].push(row)
    return groups
  }, {})
}

function orderSupplyAmount(order) {
  return approvedDetails(order).reduce(
    (sum, item) => sum + (Number(item.price) || 0) * item.quantity,
    0,
  )
}

function approvedDetails(order) {
  return order.details.filter((item) => item.status === 'approved')
}

function approvedQuantity(order) {
  return approvedDetails(order).reduce((sum, item) => sum + item.quantity, 0)
}

function aggregateStatsRows(orders) {
  const rows = new Map()

  orders.forEach((order) => {
    const date = orderDateValue(order) || order.createdAt
    approvedDetails(order).forEach((item) => {
      const key = `${date}-${item.productId}`
      const current = rows.get(key) || {
        date,
        productId: item.productId,
        productName: item.productName,
        unit: item.unit,
        quantity: 0,
        price: Number(item.price) || 0,
        amount: 0,
      }

      current.quantity += item.quantity
      current.amount += (Number(item.price) || 0) * item.quantity
      rows.set(key, current)
    })
  })

  return [...rows.values()].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return a.productName.localeCompare(b.productName, 'ko')
  })
}

function orderGroupStatus(details) {
  const statuses = details.map((item) => item.status || 'pending')
  if (statuses.every((status) => status === 'approved')) return 'approved'
  if (statuses.every((status) => status === 'rejected')) return 'rejected'
  if (!statuses.includes('pending') && statuses.includes('approved')) return 'approved'
  return 'pending'
}

function groupOrdersByStoreDate(orders) {
  const groups = new Map()

  orders.forEach((order) => {
    const date = orderDateValue(order) || order.createdAt
    const key = `${order.storeId}-${date}`
    const group = groups.get(key) || {
      key,
      storeName: order.storeName,
      date,
      requester: order.requester,
      orders: [],
      details: [],
    }

    group.orders.push(order)
    approvedAndPendingDetails(order).forEach((item) => group.details.push(item))
    groups.set(key, group)
  })

  return [...groups.values()].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return a.storeName.localeCompare(b.storeName, 'ko')
  })
}

function approvedAndPendingDetails(order) {
  return order.details.map((item) => ({
    ...item,
    status: item.status || order.status || 'pending',
    orderId: order.id,
  }))
}

function aggregateApprovalRows(details) {
  const rows = new Map()

  details.forEach((item) => {
    const key = `${item.productId}-${item.status}`
    const current = rows.get(key) || {
      productId: item.productId,
      productName: item.productName,
      unit: item.unit,
      status: item.status,
      quantity: 0,
      refs: [],
    }

    current.quantity += item.quantity
    current.refs.push(`${item.orderId}:${item.productId}`)
    rows.set(key, current)
  })

  return [...rows.values()].sort((a, b) => {
    const statusOrder = { pending: 0, approved: 1, rejected: 2 }
    if (statusOrder[a.status] !== statusOrder[b.status]) {
      return statusOrder[a.status] - statusOrder[b.status]
    }
    return a.productName.localeCompare(b.productName, 'ko')
  })
}

function renderSelectOptions() {
  const storeOptions = state.stores
    .map((store) => `<option value="${store.id}">${store.name}</option>`)
    .join('')
  els.orderStore.innerHTML = storeOptions
  els.inventoryStore.innerHTML = storeOptions

  if (state.user?.storeId) {
    els.orderStore.value = String(state.user.storeId)
    els.inventoryStore.value = String(state.user.storeId)
    els.orderStore.disabled = true
    els.inventoryStore.disabled = true
  } else {
    els.orderStore.disabled = false
    els.inventoryStore.disabled = false
  }
}

function renderDashboard() {
  const orders = visibleOrders()
  updateAdminDetailTabs()
  const inventory = visibleInventory()
  const lowRows = inventory
    .map((row) => {
      const product = state.products.find((item) => item.id === row.productId)
      const store = state.stores.find((item) => item.id === row.storeId)
      return { ...row, product, store, isLow: row.quantity < row.safetyStock }
    })
    .filter((row) => row.isLow)
  const total = orders.reduce((sum, order) => sum + approvedQuantity(order), 0)

  els.orderCount.textContent = `${orders.length}건`
  els.pendingCount.textContent = `${orders.filter((order) => order.status === 'pending').length}건`
  els.lowStockCount.textContent = `${lowRows.length}개`
  els.totalAmount.textContent = `${total}개`

  if (state.user?.role === 'admin') {
    renderAdminDashboard(orders)
    return
  }

  els.recentOrders.innerHTML =
    orders.slice(0, 4).map(renderOrderCard).join('') ||
    '<p class="empty">최근 발주가 없습니다.</p>'

  els.lowStockList.innerHTML =
    lowRows
      .map(
        (row) => `
          <article class="stock-row low">
            <div>
              <strong>${row.product.name}</strong>
              <span>${row.store.name} · 현재 ${row.quantity}${row.product.unit} / 안전 ${row.safetyStock}${row.product.unit}</span>
            </div>
            <span class="badge reject">부족</span>
          </article>
        `,
      )
      .join('') || '<p class="empty">부족 품목이 없습니다.</p>'
  const dashboardGrid = document.querySelector('#dashboard .dashboard-grid')
  dashboardGrid.classList.toggle('show-products', state.adminDetail === 'products')
  dashboardGrid.classList.toggle('show-stores', state.adminDetail === 'stores')
}

function renderAdminDashboard(orders) {
  ensureProductDateRange()
  const approvedOrders = orders.filter((order) => {
    const date = orderDateValue(order)
    return (
      approvedQuantity(order) > 0 &&
      (!state.productDateFrom || date >= state.productDateFrom) &&
      (!state.productDateTo || date <= state.productDateTo)
    )
  })
  const productRows = aggregateByProduct(approvedOrders)
  const storeRows = aggregateByStore(orders)
  updateAdminDetailTabs()

  els.recentOrders.innerHTML =
    `
      <div class="history-filter product-filter">
        <label>
          시작일
          <input type="date" value="${state.productDateFrom}" data-product-date-from />
        </label>
        <label>
          종료일
          <input type="date" value="${state.productDateTo}" data-product-date-to />
        </label>
      </div>
      ${
        productRows.length
          ? `
        ${Object.entries(groupRowsByCategory(productRows))
          .map(
            ([category, rows]) => `
              <section class="category-section">
                <div class="category-section-head">
                  <strong>${category}</strong>
                  <span>${rows.reduce((sum, row) => sum + row.quantity, 0)}개</span>
                </div>
                <div class="data-table product-summary-table">
                  <div class="table-row table-head">
                    <span>품목</span>
                    <span>수량</span>
                  </div>
                  ${rows
                    .map(
                      (row) => `
                        <div class="table-row">
                          <strong>${row.productName}</strong>
                          <strong>${row.quantity}${row.unit}</strong>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              </section>
            `,
          )
          .join('')}
      `
          : '<p class="empty">선택한 기간의 승인 완료 발주 품목이 없습니다.</p>'
      }
    `

  els.lowStockList.innerHTML =
    storeRows
      .map(
        ({ store, orderCount, total, orders: storeOrders }) => `
          <article class="store-summary">
            <div class="store-summary-head">
              <div>
                <strong>${store.name}</strong>
                <span>${orderCount}건 · 총 ${total}개</span>
              </div>
            </div>
            <div class="store-order-list">
              ${
                storeOrders
                  .map((order) => {
                    const [label, cls] = orderProgressLabel(order.status)
                    return `
                      <div class="store-order-entry">
                        <strong>${orderDateValue(order) || order.createdAt}</strong>
                        <span class="status-text ${cls}">${label}</span>
                        <span>총 ${order.total}개${order.memo ? ` · ${order.memo}` : ''}</span>
                        <div class="order-items-table">
                          ${order.details
                            .map((item) => `<span>${item.productName}</span><strong>${item.quantity}${item.unit}</strong>`)
                            .join('')}
                        </div>
                      </div>
                    `
                  })
                  .join('') || '<span class="muted-text">주문 내역 없음</span>'
              }
            </div>
          </article>
        `,
      )
      .join('')
  if (state.adminDetail === 'search') {
    renderOrderHistorySearch(orders)
  }
  document.querySelector('#dashboard .dashboard-grid').classList.toggle(
    'show-products',
    state.adminDetail === 'products',
  )
  document.querySelector('#dashboard .dashboard-grid').classList.toggle(
    'show-stores',
    state.adminDetail === 'stores',
  )
  document.querySelector('#dashboard .dashboard-grid').classList.toggle(
    'show-search',
    state.adminDetail === 'search',
  )
}

function renderOrderHistorySearch(orders) {
  if (!state.historyDateFrom || !state.historyDateTo) {
    const range = currentMonthRange()
    state.historyDateFrom ||= range.from
    state.historyDateTo ||= range.to
  }

  const filtered = orders
    .filter((order) => {
      const date = orderDateValue(order)
      return date >= state.historyDateFrom && date <= state.historyDateTo
    })
    .filter((order) => !state.historyStoreId || order.storeId === Number(state.historyStoreId))
    .sort((a, b) => b.id - a.id)
  const filteredTotal = filtered.reduce((sum, order) => sum + orderSupplyAmount(order), 0)
  const filteredQuantity = filtered.reduce((sum, order) => sum + approvedQuantity(order), 0)

  const storeOptions = state.stores
    .map((store) => `<option value="${store.id}" ${String(store.id) === String(state.historyStoreId) ? 'selected' : ''}>${store.name}</option>`)
    .join('')

  els.recentOrders.innerHTML = `
    <div class="history-filter">
      <label>
        시작일
        <input type="date" value="${state.historyDateFrom}" data-history-from />
      </label>
      <label>
        종료일
        <input type="date" value="${state.historyDateTo}" data-history-to />
      </label>
      <label>
        매장
        <select data-history-store>
          <option value="">전체 매장</option>
          ${storeOptions}
        </select>
      </label>
    </div>
    ${
      filtered.length
        ? `<div class="data-table history-table">
            <div class="table-row table-head">
              <span>날짜</span>
              <span>매장</span>
              <span>상태</span>
              <span>품목</span>
              <span>금액</span>
            </div>
            ${filtered
              .map((order) => {
                const [label, cls] = orderProgressLabel(order.status)
                const amount = orderSupplyAmount(order)
                return `
                  <div class="table-row">
                    <span>${orderDateValue(order) || order.createdAt}</span>
                    <strong>${order.storeName}</strong>
                    <span class="status-text ${cls}">${label}</span>
                    <span>${approvedDetails(order).map((item) => `${item.productName} ${item.quantity}${item.unit}`).join(' / ') || '승인 품목 없음'}</span>
                    <strong>${money(amount)}</strong>
                  </div>
                `
              })
              .join('')}
            <div class="table-row table-total">
              <strong>합계</strong>
              <span></span>
              <span></span>
              <strong>${filteredQuantity}개</strong>
              <strong>${money(filteredTotal)}</strong>
            </div>
          </div>`
        : '<p class="empty">조건에 맞는 발주 내역이 없습니다.</p>'
    }
  `
  els.lowStockList.innerHTML = ''
}

function renderProducts() {
  els.productList.innerHTML = `
    <div class="product-list-head" aria-hidden="true">
      <span>품목</span>
      <span>수량</span>
    </div>
    ${state.products
    .map((product) => {
      const draftQty = state.draft[product.id] || 0
      return `
        <article class="product-row" data-product-row="${product.id}">
          <div class="product-main">
            <span class="category">${product.category}</span>
            <strong>${product.name}</strong>
          </div>
          <div class="qty-control">
            <button type="button" class="minus" data-adjust="${product.id}" data-amount="-1">-1</button>
            <input type="number" min="0" value="${draftQty || ''}" placeholder="0" data-qty="${product.id}" aria-label="${product.name} 발주 수량" />
            <button type="button" data-adjust="${product.id}" data-amount="1">+1</button>
          </div>
        </article>
      `
    })
    .join('')}
  `

  renderDraftTotal()
}

function renderDraftTotal() {
  const total = state.products.reduce(
    (sum, product) => sum + (state.draft[product.id] || 0),
    0,
  )
  els.draftTotal.textContent = `${total}개`
}

function animateRow(productId, direction) {
  const row = document.querySelector(`[data-product-row="${productId}"]`)
  if (!row) return
  row.classList.remove('bump-up', 'bump-down')
  void row.offsetWidth
  row.classList.add(direction > 0 ? 'bump-up' : 'bump-down')
}

function renderInventory() {
  const rows = state.user?.role === 'store'
    ? state.inventory.filter((row) => row.storeId === state.user.storeId)
    : state.inventory.filter((row) => row.storeId === Number(els.inventoryStore.value || state.stores[0]?.id))

  els.inventoryList.innerHTML = rows
    .map((row) => {
      const product = state.products.find((item) => item.id === row.productId)
      const store = state.stores.find((item) => item.id === row.storeId)
      const isLow = row.quantity < row.safetyStock
      const editable = state.user?.role === 'admin'
      return `
        <article class="stock-row ${isLow ? 'low' : ''}">
          <div>
            <strong>${product.name}</strong>
            <span>${store.name} · ${product.category} · 현재 ${row.quantity}${product.unit} / 안전 ${row.safetyStock}${product.unit}</span>
          </div>
          <div class="inventory-edit">
            ${
              editable
                ? `
                  <input type="number" min="0" value="${row.quantity}" data-inventory-qty="${row.id}" aria-label="${product.name} 현재 수량" />
                  <input type="number" min="0" value="${row.safetyStock}" data-inventory-safety="${row.id}" aria-label="${product.name} 안전 재고" />
                `
                : ''
            }
            <span class="badge ${isLow ? 'reject' : 'done'}">${isLow ? '부족' : '정상'}</span>
          </div>
        </article>
      `
    })
    .join('')
}

function renderOrderCard(order) {
  const [label, cls] = statusLabel(order.status)
  return `
    <article class="order-card">
          <div class="order-head">
            <div>
              <strong>${order.storeName}</strong>
              <span>${order.createdAt} · 총 ${order.total}개</span>
            </div>
                    <span class="status-text ${cls}">${label}</span>
      </div>
      <div class="chip-list">
        ${order.details
          .map((item) => `<span class="chip">${item.productName} ${item.quantity}${item.unit}</span>`)
          .join('')}
      </div>
      ${order.memo ? `<p class="memo-text">${order.memo}</p>` : ''}
    </article>
  `
}

function renderAdminOrders() {
  const groups = groupOrdersByStoreDate(visibleOrders())
  els.adminOrders.innerHTML =
    groups
      .map((group) => {
        const status = orderGroupStatus(group.details)
        const [label, cls] = statusLabel(status)
        const orderIds = group.orders.map((order) => order.id).join(',')
        const total = group.details.reduce((sum, item) => sum + item.quantity, 0)
        const rows = aggregateApprovalRows(group.details)
        const actions = state.user?.role === 'admin'
          ? `
            <div class="order-actions">
              <button class="mini-button approve" type="button" data-status-group="${orderIds}" data-next="approved">전체 승인</button>
              <button class="mini-button reject" type="button" data-status-group="${orderIds}" data-next="rejected">전체 반려</button>
            </div>
          `
          : ''
        return `
          <article class="order-card">
            <div class="order-head">
              <div>
                <strong>${group.storeName}</strong>
                <span>${group.date} · ${group.orders.length}건 · 총 ${total}개</span>
              </div>
              <span class="status-text ${cls}">${label}</span>
            </div>
            <div class="order-detail-table">
              <div class="order-detail-row order-detail-head">
                <span>품목</span>
                <span>수량</span>
                <span>상태</span>
                <span>처리</span>
              </div>
              ${rows
                .map((item) => {
                  const [itemLabel, itemCls] = orderProgressLabel(item.status)
                  const itemActions = state.user?.role === 'admin'
                    ? `
                      <div class="item-actions">
                        <button class="mini-button approve" type="button" data-detail-batch="${item.refs.join(',')}" data-next="approved">승인</button>
                        <button class="mini-button reject" type="button" data-detail-batch="${item.refs.join(',')}" data-next="rejected">반려</button>
                      </div>
                    `
                    : ''
                  return `
                    <div class="order-detail-row">
                      <strong>${item.productName}</strong>
                      <span>${item.quantity}${item.unit}</span>
                      <span class="status-text ${itemCls}">${itemLabel}</span>
                      ${itemActions}
                    </div>
                  `
                })
                .join('')}
            </div>
            <div class="action-row">
              <span>${state.user?.role === 'admin' ? '같은 날짜의 발주는 매장별로 묶어서 처리합니다.' : '요청 상태 확인용 데이터'}</span>
              ${actions}
            </div>
          </article>
        `
      })
      .join('') || '<p class="empty">발주 내역이 없습니다.</p>'
}

function storeApprovedOrders(storeId) {
  return state.orders.filter((order) => order.storeId === storeId && approvedQuantity(order) > 0)
}

function storeAmountBeforeDate(storeId, dateValue) {
  return storeApprovedOrders(storeId)
    .filter((order) => orderDateValue(order) < dateValue)
    .reduce((sum, order) => sum + orderSupplyAmount(order), 0)
}

function storePaidBeforeDate(storeId, dateValue) {
  return state.settlements
    .filter((item) => item.storeId === storeId && settlementDateValue(item) < dateValue)
    .reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0)
}

function storePaidInRange(storeId, from, to) {
  return state.settlements
    .filter((item) => {
      const date = settlementDateValue(item)
      return item.storeId === storeId && date >= from && date <= to
    })
    .reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0)
}

function storePaymentsInRange(storeId, from, to) {
  return state.settlements
    .filter((item) => {
      const date = settlementDateValue(item)
      return item.storeId === storeId && date >= from && date <= to
    })
    .sort((a, b) => settlementDateValue(b).localeCompare(settlementDateValue(a)) || b.id - a.id)
}

function ensureStatsDateRange() {
  if (state.statsDateFrom && state.statsDateTo) return
  const range = currentMonthRange()
  state.statsDateFrom ||= range.from
  state.statsDateTo ||= range.to
}

function renderStats() {
  ensureStatsDateRange()
  const from = state.statsDateFrom
  const to = state.statsDateTo
  const monthOrders = visibleOrders()
    .filter((order) => {
      const date = orderDateValue(order)
      return approvedQuantity(order) > 0 && date >= from && date <= to
    })
    .sort((a, b) => b.id - a.id)
  const monthAmount = monthOrders.reduce((sum, order) => sum + orderSupplyAmount(order), 0)
  const monthQuantity = monthOrders.reduce((sum, order) => sum + approvedQuantity(order), 0)
  const previousBalanceTotal = state.stores.reduce(
    (sum, store) => sum + Math.max(0, storeAmountBeforeDate(store.id, from) - storePaidBeforeDate(store.id, from)),
    0,
  )
  const paidTotal = state.stores.reduce((sum, store) => sum + storePaidInRange(store.id, from, to), 0)
  const finalTotal = Math.max(0, previousBalanceTotal + monthAmount - paidTotal)

  els.storeStats.innerHTML = `
    <div class="history-filter stats-filter">
      <label>
        시작일
        <input type="date" value="${from}" data-stats-from />
      </label>
      <label>
        종료일
        <input type="date" value="${to}" data-stats-to />
      </label>
      <a class="download-link export-link" href="/api/export/settlement.xls?from=${from}&to=${to}">엑셀 다운로드</a>
    </div>
    ${state.stores
      .map((store) => {
        const orders = monthOrders.filter((order) => order.storeId === store.id)
        const statsRows = aggregateStatsRows(orders)
        const previousBalance = Math.max(
          0,
          storeAmountBeforeDate(store.id, from) - storePaidBeforeDate(store.id, from),
        )
        const orderAmount = orders.reduce((sum, order) => sum + orderSupplyAmount(order), 0)
        const paidAmount = storePaidInRange(store.id, from, to)
        const payments = storePaymentsInRange(store.id, from, to)
        const balance = Math.max(0, previousBalance + orderAmount - paidAmount)

        return `
          <section class="settlement-card">
            <div class="settlement-head">
              <div>
                <strong>${store.name}</strong>
                <span>${orders.length}건 · 주문 ${money(orderAmount)}</span>
              </div>
              <strong class="${balance ? 'debt-text' : 'paid-text'}">${balance ? `미수 ${money(balance)}` : '정산 완료'}</strong>
            </div>
            ${
              statsRows.length
                ? `<div class="data-table stats-table">
                    <div class="table-row table-head">
                      <span>날짜</span>
                      <span>품목</span>
                      <span>수량</span>
                      <span>단가</span>
                      <span>합계</span>
                    </div>
                    ${statsRows
                      .map((item) => `
                        <div class="table-row">
                          <span>${item.date}</span>
                          <strong>${item.productName}</strong>
                          <span>${item.quantity}${item.unit}</span>
                          <span>${money(item.price)}</span>
                          <strong>${money(item.amount)}</strong>
                        </div>
                      `)
                      .join('')}
                    <div class="table-row table-total">
                      <strong>합계</strong>
                      <span></span>
                      <strong>${statsRows.reduce((sum, item) => sum + item.quantity, 0)}개</strong>
                      <span></span>
                      <strong>${money(statsRows.reduce((sum, item) => sum + item.amount, 0))}</strong>
                    </div>
                  </div>`
                : '<p class="empty">선택한 월의 주문 내역이 없습니다.</p>'
            }
            <div class="settlement-grid settlement-grid-bottom">
              <div><span>이전 미수</span><strong>${money(previousBalance)}</strong></div>
              <div><span>기간 주문</span><strong>${money(orderAmount)}</strong></div>
              <div><span>기간 입금</span><strong>${money(paidAmount)}</strong></div>
              <div><span>총합계</span><strong>${money(balance)}</strong></div>
            </div>
            <div class="payment-panel">
              <div class="payment-form">
                <label>
                  입금일
                  <input type="date" value="${to}" data-payment-date="${store.id}" />
                </label>
                <label>
                  입금액
                  <input type="number" min="0" placeholder="0" data-payment-amount="${store.id}" />
                </label>
                <button class="mini-button approve" type="button" data-payment-add="${store.id}">추가</button>
              </div>
              ${
                payments.length
                  ? `<div class="data-table payment-table">
                      <div class="table-row table-head">
                        <span>입금일</span>
                        <span>입금액</span>
                        <span>처리</span>
                      </div>
                      ${payments
                        .map((payment) => `
                          <div class="table-row" data-payment-row="${payment.id}">
                            <input type="date" value="${settlementDateValue(payment)}" data-payment-edit-date="${payment.id}" />
                            <input type="number" min="0" value="${Number(payment.paidAmount) || 0}" data-payment-edit-amount="${payment.id}" />
                            <span class="payment-actions">
                              <button class="mini-button approve" type="button" data-payment-save="${payment.id}">저장</button>
                              <button class="mini-button reject" type="button" data-payment-delete="${payment.id}">삭제</button>
                            </span>
                          </div>
                        `)
                        .join('')}
                    </div>`
                  : '<p class="empty payment-empty">선택한 기간의 입금 내역이 없습니다.</p>'
              }
            </div>
          </section>
        `
      })
      .join('')}
    <div class="stats-summary stats-summary-bottom">
      <strong>${from} ~ ${to}</strong>
      <span>미수 ${money(previousBalanceTotal)} · 주문 ${money(monthAmount)} · 입금 ${money(paidTotal)} · 총합계 ${money(finalTotal)}</span>
    </div>
  `
}

function renderPrices() {
  const groups = groupRowsByCategory(state.products)
  els.priceList.innerHTML = Object.entries(groups)
    .map(
      ([category, products]) => `
        <section class="category-section">
          <div class="category-section-head">
            <strong>${category}</strong>
            <span>${products.length}개 품목</span>
          </div>
          <div class="data-table price-table">
            <div class="table-row table-head">
              <span>품목</span>
              <span>단가</span>
            </div>
            ${products
              .map(
                (product) => `
                  <div class="table-row">
                    <strong>${product.name}</strong>
                    <input type="number" min="0" step="100" value="${Number(product.price) || 0}" data-price="${product.id}" aria-label="${product.name} 단가" />
                  </div>
                `,
              )
              .join('')}
          </div>
        </section>
      `,
    )
    .join('')
}

function renderAll() {
  if (!state.user) return
  renderRoleShell()
  renderSelectOptions()
  renderDashboard()
  renderProducts()
  renderInventory()
  renderAdminOrders()
  renderStats()
  renderPrices()
}

async function login() {
  try {
    const result = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({
        name: els.loginName.value,
        password: els.loginPassword.value,
      }),
    })
    state.user = result.user
    state.adminDetail = 'products'
    localStorage.setItem('stockmateUser', JSON.stringify(state.user))
    els.loginScreen.classList.add('hidden')
    els.appShell.classList.remove('hidden')
    await loadData()
    setView(state.user.role === 'store' ? 'order' : 'dashboard')
    showToast('로그인되었습니다.')
  } catch (error) {
    showToast(error.message)
  }
}

function logout() {
  state.user = null
  state.draft = {}
  state.adminDetail = 'products'
  localStorage.removeItem('stockmateUser')
  els.appShell.classList.add('hidden')
  els.loginScreen.classList.remove('hidden')
  showToast('로그아웃되었습니다.')
}

async function submitOrder() {
  const details = Object.entries(state.draft)
    .map(([productId, quantity]) => ({ productId: Number(productId), quantity }))
    .filter((item) => item.quantity > 0)

  if (!details.length) {
    showToast('발주 수량을 입력하세요.')
    return
  }

  try {
    await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        storeId: Number(els.orderStore.value),
        userId: state.user.id,
        memo: els.orderMemo.value.trim(),
        details,
      }),
    })
    state.draft = {}
    els.orderMemo.value = ''
    await loadData()
    setView('dashboard')
    showToast('발주 요청이 등록되었습니다.')
  } catch (error) {
    showToast(error.message)
  }
}

document.querySelectorAll('[data-jump]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.jump))
})

$('#loginButton').addEventListener('click', login)
$('#logoutButton').addEventListener('click', logout)
$('#submitOrder').addEventListener('click', submitOrder)

els.orderStore.addEventListener('change', () => {
  state.draft = {}
  renderProducts()
})

els.inventoryStore.addEventListener('change', renderInventory)

els.productList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-adjust]')
  if (!button) return
  const id = Number(button.dataset.adjust)
  const amount = Number(button.dataset.amount)
  state.draft[id] = Math.max(0, (state.draft[id] || 0) + amount)
  renderProducts()
  animateRow(id, amount)
})

els.productList.addEventListener('input', (event) => {
  const input = event.target.closest('[data-qty]')
  if (!input) return
  state.draft[Number(input.dataset.qty)] = Math.max(0, Number(input.value) || 0)
  renderDraftTotal()
})

els.adminDetailTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-admin-detail]')
  if (!button) return
  state.adminDetail = button.dataset.adminDetail
  renderDashboard()
})

els.recentOrders.addEventListener('change', (event) => {
  const productDateFrom = event.target.closest('[data-product-date-from]')
  if (productDateFrom) {
    state.productDateFrom = productDateFrom.value
    renderDashboard()
    return
  }

  const productDateTo = event.target.closest('[data-product-date-to]')
  if (productDateTo) {
    state.productDateTo = productDateTo.value
    renderDashboard()
    return
  }

  const fromInput = event.target.closest('[data-history-from]')
  if (fromInput) {
    state.historyDateFrom = fromInput.value || currentMonthRange().from
    if (state.historyDateTo && state.historyDateFrom > state.historyDateTo) {
      state.historyDateTo = state.historyDateFrom
    }
    renderDashboard()
    return
  }

  const toInput = event.target.closest('[data-history-to]')
  if (toInput) {
    state.historyDateTo = toInput.value || currentMonthRange().to
    if (state.historyDateFrom && state.historyDateTo < state.historyDateFrom) {
      state.historyDateFrom = state.historyDateTo
    }
    renderDashboard()
    return
  }

  const storeSelect = event.target.closest('[data-history-store]')
  if (storeSelect) {
    state.historyStoreId = storeSelect.value
    renderDashboard()
  }
})

els.adminOrders.addEventListener('click', async (event) => {
  const detailBatchButton = event.target.closest('[data-detail-batch]')
  const orderGroupButton = event.target.closest('[data-status-group]')
  const detailButton = event.target.closest('[data-detail-status]')
  const orderButton = event.target.closest('[data-status]')
  const button = detailBatchButton || orderGroupButton || detailButton || orderButton
  if (!button) return

  try {
    if (detailBatchButton) {
      const refs = button.dataset.detailBatch.split(',').filter(Boolean)
      await Promise.all(refs.map((ref) => {
        const [orderId, productId] = ref.split(':')
        return api(`/api/orders/${orderId}/details/${productId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: button.dataset.next }),
        })
      }))
    } else if (orderGroupButton) {
      const orderIds = button.dataset.statusGroup.split(',').filter(Boolean)
      await Promise.all(orderIds.map((orderId) =>
        api(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: button.dataset.next }),
        }),
      ))
    } else if (detailButton) {
      await api(`/api/orders/${button.dataset.detailStatus}/details/${button.dataset.product}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: button.dataset.next }),
      })
    } else {
      await api(`/api/orders/${button.dataset.status}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: button.dataset.next }),
      })
    }
    await loadData()
    showToast(button.dataset.next === 'approved' ? '승인했습니다.' : '반려했습니다.')
  } catch (error) {
    showToast(error.message)
  }
})

els.inventoryList.addEventListener('change', async (event) => {
  if (state.user?.role !== 'admin') return
  const qtyInput = event.target.closest('[data-inventory-qty]')
  const safetyInput = event.target.closest('[data-inventory-safety]')
  const input = qtyInput || safetyInput
  if (!input) return

  const id = input.dataset.inventoryQty || input.dataset.inventorySafety
  const rowEl = input.closest('.stock-row')
  const quantity = rowEl.querySelector('[data-inventory-qty]').value
  const safetyStock = rowEl.querySelector('[data-inventory-safety]').value

  try {
    await api(`/api/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity, safetyStock }),
    })
    await loadData()
    showToast('재고가 수정되었습니다.')
  } catch (error) {
    showToast(error.message)
  }
})

els.priceList.addEventListener('change', async (event) => {
  const input = event.target.closest('[data-price]')
  if (!input) return

  try {
    await api(`/api/products/${input.dataset.price}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ price: input.value }),
    })
    await loadData()
    showToast('단가가 저장되었습니다.')
  } catch (error) {
    showToast(error.message)
  }
})

els.storeStats.addEventListener('change', async (event) => {
  const fromInput = event.target.closest('[data-stats-from]')
  if (fromInput) {
    state.statsDateFrom = fromInput.value || currentMonthRange().from
    if (state.statsDateTo && state.statsDateFrom > state.statsDateTo) {
      state.statsDateTo = state.statsDateFrom
    }
    renderStats()
    return
  }

  const toInput = event.target.closest('[data-stats-to]')
  if (toInput) {
    state.statsDateTo = toInput.value || currentMonthRange().to
    if (state.statsDateFrom && state.statsDateTo < state.statsDateFrom) {
      state.statsDateFrom = state.statsDateTo
    }
    renderStats()
  }
})

els.storeStats.addEventListener('click', async (event) => {
  const addButton = event.target.closest('[data-payment-add]')
  const saveButton = event.target.closest('[data-payment-save]')
  const deleteButton = event.target.closest('[data-payment-delete]')
  const button = addButton || saveButton || deleteButton
  if (!button) return

  const card = button.closest('.settlement-card')

  try {
    if (addButton) {
      const storeId = Number(button.dataset.paymentAdd)
      const date = card.querySelector(`[data-payment-date="${storeId}"]`).value
      const paidAmount = card.querySelector(`[data-payment-amount="${storeId}"]`).value
      await api('/api/settlements', {
        method: 'POST',
        body: JSON.stringify({ storeId, date, paidAmount }),
      })
    } else if (saveButton) {
      const id = button.dataset.paymentSave
      const row = button.closest('[data-payment-row]')
      const date = row.querySelector(`[data-payment-edit-date="${id}"]`).value
      const paidAmount = row.querySelector(`[data-payment-edit-amount="${id}"]`).value
      await api(`/api/settlements/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ date, paidAmount }),
      })
    } else if (deleteButton) {
      await api(`/api/settlements/${button.dataset.paymentDelete}`, {
        method: 'DELETE',
      })
    }

    await loadData()
    showToast(deleteButton ? '입금 내역을 삭제했습니다.' : '입금 내역을 저장했습니다.')
  } catch (error) {
    showToast(error.message)
  }
})

localStorage.removeItem('stockmateUser')
