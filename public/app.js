const state = {
  user: null,
  stores: [],
  products: [],
  inventory: [],
  orders: [],
  stats: null,
  draft: {},
}

const $ = (selector) => document.querySelector(selector)
const money = (value) => `${Number(value).toLocaleString('ko-KR')}원`

const navByRole = {
  store: [
    { id: 'dashboard', label: '매장 대시보드' },
    { id: 'order', label: '발주 신청' },
    { id: 'inventory', label: '매장 재고' },
    { id: 'admin', label: '내 발주 내역' },
  ],
  admin: [
    { id: 'dashboard', label: '관리자 대시보드' },
    { id: 'admin', label: '발주 승인' },
    { id: 'inventory', label: '전체 재고' },
    { id: 'stats', label: '통계' },
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
  state.stats = data.stats
  renderAll()
}

function renderRoleShell() {
  const roleName = state.user.role === 'admin' ? '관리자' : '매장'
  els.currentUser.textContent = state.user.name
  els.roleLabel.textContent = roleName
  els.workspaceEyebrow.textContent =
    state.user.role === 'admin' ? 'Admin Workspace' : 'Store Workspace'
  els.workspaceTitle.textContent =
    state.user.role === 'admin' ? '관리자 업무 화면' : '매장 전용 화면'
  els.todayPill.textContent = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  els.dashboardTitle.textContent =
    state.user.role === 'admin' ? '관리자 대시보드' : '매장 대시보드'
  els.dashboardDesc.textContent =
    state.user.role === 'admin'
      ? '전체 매장의 발주 대기, 부족 재고, 누적 금액을 확인합니다.'
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
  const inventory = visibleInventory()
  const lowRows = inventory
    .map((row) => {
      const product = state.products.find((item) => item.id === row.productId)
      const store = state.stores.find((item) => item.id === row.storeId)
      return { ...row, product, store, isLow: row.quantity < row.safetyStock }
    })
    .filter((row) => row.isLow)
  const total = orders.reduce((sum, order) => sum + order.total, 0)

  els.orderCount.textContent = `${orders.length}건`
  els.pendingCount.textContent = `${orders.filter((order) => order.status === 'pending').length}건`
  els.lowStockCount.textContent = `${lowRows.length}개`
  els.totalAmount.textContent = money(total)

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
}

function renderProducts() {
  const storeId = Number(els.orderStore.value || state.user?.storeId || state.stores[0]?.id)
  const inventoryByProduct = new Map(
    state.inventory
      .filter((row) => row.storeId === storeId)
      .map((row) => [row.productId, row]),
  )

  els.productList.innerHTML = state.products
    .map((product) => {
      const row = inventoryByProduct.get(product.id)
      const draftQty = state.draft[product.id] || 0
      const isLow = row && row.quantity < row.safetyStock
      return `
        <article class="product-row ${isLow ? 'low' : ''}" data-product-row="${product.id}">
          <div>
            <span class="category">${product.category}</span>
            <strong>${product.name}</strong>
            <p>${money(product.price)} · 재고 ${row?.quantity ?? 0}${product.unit} / 안전 ${row?.safetyStock ?? 0}${product.unit}</p>
          </div>
          <div class="qty-control">
            <button type="button" class="minus" data-adjust="${product.id}" data-amount="-5">-5</button>
            <button type="button" class="minus" data-adjust="${product.id}" data-amount="-1">-1</button>
            <input type="number" min="0" value="${draftQty || ''}" placeholder="0" data-qty="${product.id}" aria-label="${product.name} 발주 수량" />
            <button type="button" data-adjust="${product.id}" data-amount="1">+1</button>
            <button type="button" data-adjust="${product.id}" data-amount="5">+5</button>
          </div>
        </article>
      `
    })
    .join('')

  renderDraftTotal()
}

function renderDraftTotal() {
  const total = state.products.reduce(
    (sum, product) => sum + (state.draft[product.id] || 0) * product.price,
    0,
  )
  els.draftTotal.textContent = money(total)
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
          <span>${order.createdAt} · ${money(order.total)}</span>
        </div>
        <span class="badge ${cls}">${label}</span>
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
  const orders = visibleOrders()
  els.adminOrders.innerHTML =
    orders
      .map((order) => {
        const [label, cls] = statusLabel(order.status)
        const actions = state.user?.role === 'admin'
          ? `
            <div>
              <button class="mini-button approve" type="button" data-status="${order.id}" data-next="approved">승인</button>
              <button class="mini-button reject" type="button" data-status="${order.id}" data-next="rejected">반려</button>
            </div>
          `
          : ''
        return `
          <article class="order-card">
            <div class="order-head">
              <div>
                <strong>${order.storeName}</strong>
                <span>${order.createdAt} · ${order.requester} · ${money(order.total)}</span>
              </div>
              <span class="badge ${cls}">${label}</span>
            </div>
            <div class="chip-list">
              ${order.details
                .map((item) => `<span class="chip">${item.productName} ${item.quantity}${item.unit}</span>`)
                .join('')}
            </div>
            <div class="action-row">
              <span>${state.user?.role === 'admin' ? '본사 물량 준비용 데이터' : '요청 상태 확인용 데이터'}</span>
              ${actions}
            </div>
          </article>
        `
      })
      .join('') || '<p class="empty">발주 내역이 없습니다.</p>'
}

function renderStats() {
  els.storeStats.innerHTML = state.stats.storeStats
    .map((store) => {
      const percent = state.stats.totalAmount
        ? Math.round((store.totalAmount / state.stats.totalAmount) * 100)
        : 0
      return `
        <article class="stat-row">
          <div>
            <strong>${store.storeName}</strong>
            <span>${store.orderCount}건 · ${money(store.totalAmount)}</span>
          </div>
          <div class="bar-track">
            <span style="width: ${percent}%"></span>
          </div>
        </article>
      `
    })
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
    localStorage.setItem('stockmateUser', JSON.stringify(state.user))
    els.loginScreen.classList.add('hidden')
    els.appShell.classList.remove('hidden')
    await loadData()
    setView('dashboard')
    showToast('로그인되었습니다.')
  } catch (error) {
    showToast(error.message)
  }
}

function logout() {
  state.user = null
  state.draft = {}
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

els.adminOrders.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-status]')
  if (!button) return
  try {
    await api(`/api/orders/${button.dataset.status}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: button.dataset.next }),
    })
    await loadData()
    showToast(button.dataset.next === 'approved' ? '발주를 승인했습니다.' : '발주를 반려했습니다.')
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

localStorage.removeItem('stockmateUser')
