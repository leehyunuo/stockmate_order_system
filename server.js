const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = process.env.PORT || 3000
const DB_PATH = path.join(__dirname, 'data', 'db.json')

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'))
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

function enrichOrder(db, order) {
  const store = db.stores.find((item) => item.id === order.storeId)
  const user = db.users.find((item) => item.id === order.userId)
  const details = order.details.map((detail) => {
    const product = db.products.find((item) => item.id === detail.productId)
    return {
      ...detail,
      productName: product.name,
      category: product.category,
      unit: product.unit,
      price: product.price,
      lineTotal: product.price * detail.quantity,
    }
  })

  return {
    ...order,
    storeName: store?.name || '알 수 없음',
    requester: user?.name || '알 수 없음',
    details,
    total: details.reduce((sum, item) => sum + item.lineTotal, 0),
  }
}

function getInventoryRows(db, storeId) {
  return db.inventory
    .filter((item) => item.storeId === storeId)
    .map((item) => {
      const product = db.products.find((productItem) => productItem.id === item.productId)
      return {
        ...item,
        productName: product.name,
        category: product.category,
        unit: product.unit,
        price: product.price,
        isLow: item.quantity < item.safetyStock,
      }
    })
}

function getStats(db) {
  const enrichedOrders = db.orders.map((order) => enrichOrder(db, order))
  const pendingOrders = enrichedOrders.filter((order) => order.status === 'pending')
  const approvedOrders = enrichedOrders.filter((order) => order.status === 'approved')
  const lowStockRows = db.inventory.filter((item) => item.quantity < item.safetyStock)
  const totalAmount = enrichedOrders.reduce((sum, order) => sum + order.total, 0)
  const storeStats = db.stores.map((store) => {
    const storeOrders = enrichedOrders.filter((order) => order.storeId === store.id)
    return {
      storeId: store.id,
      storeName: store.name,
      orderCount: storeOrders.length,
      totalAmount: storeOrders.reduce((sum, order) => sum + order.total, 0),
    }
  })

  return {
    orderCount: enrichedOrders.length,
    pendingCount: pendingOrders.length,
    approvedCount: approvedOrders.length,
    lowStockCount: lowStockRows.length,
    totalAmount,
    storeStats,
  }
}

app.post('/api/login', (req, res) => {
  const { name, password } = req.body
  const db = readDb()
  const user = db.users.find(
    (item) => item.name === name && item.password === password,
  )

  if (!user) {
    return res.status(401).json({
      success: false,
      message: '이름 또는 비밀번호가 올바르지 않습니다.',
    })
  }

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      storeId: user.storeId,
    },
  })
})

app.get('/api/bootstrap', (req, res) => {
  const db = readDb()
  res.json({
    stores: db.stores,
    products: db.products,
    inventory: db.inventory,
    orders: db.orders.map((order) => enrichOrder(db, order)),
    stats: getStats(db),
  })
})

app.get('/api/stores/:storeId/inventory', (req, res) => {
  const db = readDb()
  const storeId = Number(req.params.storeId)
  res.json({
    success: true,
    data: getInventoryRows(db, storeId),
  })
})

app.post('/api/orders', (req, res) => {
  const { storeId, userId, memo, details } = req.body

  if (!storeId || !userId || !Array.isArray(details) || details.length === 0) {
    return res.status(400).json({
      success: false,
      message: '매장, 사용자, 발주 품목 정보가 필요합니다.',
    })
  }

  const db = readDb()
  const order = {
    id: Date.now(),
    storeId: Number(storeId),
    userId: Number(userId),
    status: 'pending',
    createdAt: new Date().toLocaleString('ko-KR'),
    memo: memo || '',
    details: details
      .map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.productId && item.quantity > 0),
  }

  if (order.details.length === 0) {
    return res.status(400).json({
      success: false,
      message: '수량이 1개 이상인 품목을 선택해야 합니다.',
    })
  }

  db.orders.unshift(order)
  writeDb(db)

  res.status(201).json({
    success: true,
    message: '발주 요청이 등록되었습니다.',
    order: enrichOrder(db, order),
  })
})

app.patch('/api/orders/:orderId/status', (req, res) => {
  const { status } = req.body
  const orderId = Number(req.params.orderId)

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({
      success: false,
      message: '올바른 상태값이 아닙니다.',
    })
  }

  const db = readDb()
  const order = db.orders.find((item) => item.id === orderId)

  if (!order) {
    return res.status(404).json({
      success: false,
      message: '발주를 찾을 수 없습니다.',
    })
  }

  const previousStatus = order.status
  order.status = status

  if (status === 'approved' && previousStatus !== 'approved') {
    order.details.forEach((detail) => {
      const inventoryRow = db.inventory.find(
        (item) => item.storeId === order.storeId && item.productId === detail.productId,
      )
      if (inventoryRow) {
        inventoryRow.quantity += detail.quantity
      }
    })
  }

  writeDb(db)

  res.json({
    success: true,
    message: '발주 상태가 변경되었습니다.',
    order: enrichOrder(db, order),
  })
})

app.patch('/api/inventory/:inventoryId', (req, res) => {
  const inventoryId = Number(req.params.inventoryId)
  const { quantity, safetyStock } = req.body
  const db = readDb()
  const row = db.inventory.find((item) => item.id === inventoryId)

  if (!row) {
    return res.status(404).json({
      success: false,
      message: '재고 항목을 찾을 수 없습니다.',
    })
  }

  if (quantity !== undefined) row.quantity = Math.max(0, Number(quantity))
  if (safetyStock !== undefined) row.safetyStock = Math.max(0, Number(safetyStock))

  writeDb(db)

  res.json({
    success: true,
    message: '재고가 수정되었습니다.',
    row,
  })
})

app.get('/api/stats', (req, res) => {
  const db = readDb()
  res.json({
    success: true,
    data: getStats(db),
  })
})

app.get('/api/export/orders.csv', (req, res) => {
  const db = readDb()
  const rows = [['매장', '요청자', '일시', '상태', '품목', '금액']]
  db.orders.map((order) => enrichOrder(db, order)).forEach((order) => {
    rows.push([
      order.storeName,
      order.requester,
      order.createdAt,
      order.status,
      order.details.map((item) => `${item.productName} ${item.quantity}${item.unit}`).join(' / '),
      order.total,
    ])
  })

  const csv = `\uFEFF${rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')}`

  res.setHeader('Content-Type', 'text/csv;charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="stockmate_orders.csv"')
  res.send(csv)
})

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 경로를 찾을 수 없습니다.',
  })
})

app.listen(PORT, () => {
  console.log(`StockMate server is running at http://localhost:${PORT}`)
})
