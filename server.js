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
      productName: product?.name || '알 수 없음',
      category: product?.category || '',
      unit: product?.unit || '개',
      status: detail.status || order.status || 'pending',
      price: Number(product?.price) || 0,
      lineAmount: (Number(product?.price) || 0) * detail.quantity,
    }
  })

  return {
    ...order,
    storeName: store?.name || '알 수 없음',
    requester: user?.name || '알 수 없음',
    details,
    total: details.reduce((sum, item) => sum + item.quantity, 0),
    approvedTotal: details
      .filter((item) => item.status === 'approved')
      .reduce((sum, item) => sum + item.quantity, 0),
    supplyAmount: details.reduce((sum, item) => sum + item.lineAmount, 0),
    approvedSupplyAmount: details
      .filter((item) => item.status === 'approved')
      .reduce((sum, item) => sum + item.lineAmount, 0),
  }
}

function getInventoryRows(db, storeId) {
  return db.inventory
    .filter((item) => item.storeId === storeId)
    .map((item) => {
      const product = db.products.find((productItem) => productItem.id === item.productId)
      return {
        ...item,
        productName: product?.name || '알 수 없음',
        category: product?.category || '',
        unit: product?.unit || '개',
        isLow: item.quantity < item.safetyStock,
      }
    })
}

function getStats(db) {
  const enrichedOrders = db.orders.map((order) => enrichOrder(db, order))
  const pendingOrders = enrichedOrders.filter((order) => order.status === 'pending')
  const approvedOrders = enrichedOrders.filter((order) => order.approvedTotal > 0)
  const lowStockRows = db.inventory.filter((item) => item.quantity < item.safetyStock)
  const totalAmount = enrichedOrders.reduce((sum, order) => sum + order.approvedTotal, 0)
  const storeStats = db.stores.map((store) => {
    const storeOrders = enrichedOrders.filter((order) => order.storeId === store.id)
    return {
      storeId: store.id,
      storeName: store.name,
      orderCount: storeOrders.length,
      totalAmount: storeOrders.reduce((sum, order) => sum + order.approvedTotal, 0),
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

function monthValueFromDate(dateValue) {
  return String(dateValue || '').slice(0, 7)
}

function orderSupplyAmount(order) {
  return order.details
    .filter((item) => item.status === 'approved')
    .reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0)
}

function aggregateApprovedRows(orders) {
  const rows = new Map()

  orders.forEach((order) => {
    const date = orderDateValue(order) || order.createdAt
    order.details
      .filter((item) => item.status === 'approved')
      .forEach((item) => {
        const key = `${date}-${item.productId}`
        const current = rows.get(key) || {
          date,
          productId: item.productId,
          productName: item.productName,
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

function aggregateOrdersByStoreDate(orders) {
  const groups = new Map()

  orders.forEach((order) => {
    const date = orderDateValue(order) || order.createdAt
    const key = `${order.storeId}-${date}`
    const group = groups.get(key) || {
      storeId: order.storeId,
      storeName: order.storeName,
      date,
      orders: [],
    }

    group.orders.push(order)
    groups.set(key, group)
  })

  return [...groups.values()].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return a.storeName.localeCompare(b.storeName, 'ko')
  })
}

function applyInventoryStatusChange(db, order, detail, previousStatus, nextStatus) {
  if (previousStatus === nextStatus) return

  const inventoryRow = db.inventory.find(
    (item) => item.storeId === order.storeId && item.productId === detail.productId,
  )

  if (!inventoryRow) return

  if (nextStatus === 'approved') {
    inventoryRow.quantity += detail.quantity
  }

  if (previousStatus === 'approved' && nextStatus !== 'approved') {
    inventoryRow.quantity = Math.max(0, inventoryRow.quantity - detail.quantity)
  }
}

function storeApprovedOrders(db, storeId) {
  return db.orders
    .map((order) => enrichOrder(db, order))
    .filter((order) => order.storeId === storeId && order.approvedTotal > 0)
}

function storeAmountBeforeDate(db, storeId, dateValue) {
  return storeApprovedOrders(db, storeId)
    .filter((order) => orderDateValue(order) < dateValue)
    .reduce((sum, order) => sum + orderSupplyAmount(order), 0)
}

function settlementDateValue(settlement) {
  if (settlement.date) return settlement.date
  if (settlement.month) return `${settlement.month}-01`
  return ''
}

function storePaidBeforeDate(db, storeId, dateValue) {
  return (db.settlements || [])
    .filter((item) => item.storeId === storeId && settlementDateValue(item) < dateValue)
    .reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0)
}

function storePaidInRange(db, storeId, from, to) {
  return (db.settlements || [])
    .filter((item) => {
      const date = settlementDateValue(item)
      return item.storeId === storeId && date >= from && date <= to
    })
    .reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0)
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ko-KR')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function sheetName(value) {
  const name = String(value || 'Sheet')
    .replace(/[\\/?*\[\]:]/g, ' ')
    .slice(0, 31)
    .trim()
  return name || 'Sheet'
}

function excelCell(value, type = 'String') {
  const data = type === 'Number' ? Number(value) || 0 : escapeXml(value)
  return `<Cell><Data ss:Type="${type}">${data}</Data></Cell>`
}

function excelRow(cells) {
  return `<Row>${cells.map((cell) => excelCell(cell.value, cell.type)).join('')}</Row>`
}

function excelWorksheet(name, rows) {
  return `
    <Worksheet ss:Name="${escapeXml(sheetName(name))}">
      <Table>
        ${rows.map((row) => excelRow(row)).join('')}
      </Table>
    </Worksheet>
  `
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`
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
    settlements: db.settlements || [],
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
        status: 'pending',
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

  order.details.forEach((detail) => {
    detail.status = detail.status || order.status || 'pending'
  })

  order.status = status
  order.details.forEach((detail) => {
    const previousDetailStatus = detail.status
    detail.status = status
    applyInventoryStatusChange(db, order, detail, previousDetailStatus, status)
  })

  writeDb(db)

  res.json({
    success: true,
    message: '발주 상태가 변경되었습니다.',
    order: enrichOrder(db, order),
  })
})

app.patch('/api/orders/:orderId/details/:productId/status', (req, res) => {
  const { status } = req.body
  const orderId = Number(req.params.orderId)
  const productId = Number(req.params.productId)

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

  order.details.forEach((item) => {
    item.status = item.status || order.status || 'pending'
  })

  const detail = order.details.find((item) => item.productId === productId)

  if (!detail) {
    return res.status(404).json({
      success: false,
      message: '발주 품목을 찾을 수 없습니다.',
    })
  }

  const previousDetailStatus = detail.status
  detail.status = status
  applyInventoryStatusChange(db, order, detail, previousDetailStatus, status)

  const detailStatuses = order.details.map((item) => item.status || 'pending')

  if (detailStatuses.every((item) => item === 'approved')) {
    order.status = 'approved'
  } else if (detailStatuses.every((item) => item === 'rejected')) {
    order.status = 'rejected'
  } else if (!detailStatuses.includes('pending')) {
    order.status = detailStatuses.includes('approved') ? 'approved' : 'rejected'
  } else {
    order.status = 'pending'
  }

  writeDb(db)

  res.json({
    success: true,
    message: '품목 상태가 변경되었습니다.',
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

app.patch('/api/products/:productId/price', (req, res) => {
  const productId = Number(req.params.productId)
  const { price } = req.body
  const db = readDb()
  const product = db.products.find((item) => item.id === productId)

  if (!product) {
    return res.status(404).json({
      success: false,
      message: '품목을 찾을 수 없습니다.',
    })
  }

  product.price = Math.max(0, Number(price) || 0)
  writeDb(db)

  res.json({
    success: true,
    message: '단가가 수정되었습니다.',
    product,
  })
})

app.post('/api/settlements', (req, res) => {
  const { storeId, date, paidAmount } = req.body

  if (!storeId || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
    return res.status(400).json({
      success: false,
      message: '매장과 입금 날짜가 필요합니다.',
    })
  }

  const db = readDb()
  if (!Array.isArray(db.settlements)) db.settlements = []

  const settlement = {
    id: Date.now(),
    storeId: Number(storeId),
    date,
    paidAmount: Math.max(0, Number(paidAmount) || 0),
  }

  db.settlements.push(settlement)
  writeDb(db)

  res.json({
    success: true,
    message: '입금 내역이 추가되었습니다.',
    settlement,
  })
})

app.patch('/api/settlements/:settlementId', (req, res) => {
  const settlementId = Number(req.params.settlementId)
  const { date, paidAmount } = req.body

  const db = readDb()
  if (!Array.isArray(db.settlements)) db.settlements = []

  const settlement = db.settlements.find((item) => item.id === settlementId)

  if (!settlement) {
    return res.status(404).json({
      success: false,
      message: '입금 내역을 찾을 수 없습니다.',
    })
  }

  if (date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return res.status(400).json({
        success: false,
        message: '올바른 입금 날짜가 필요합니다.',
      })
    }
    settlement.date = date
    delete settlement.month
  }
  if (paidAmount !== undefined) settlement.paidAmount = Math.max(0, Number(paidAmount) || 0)

  writeDb(db)

  res.json({
    success: true,
    message: '입금 내역이 수정되었습니다.',
    settlement,
  })
})

app.delete('/api/settlements/:settlementId', (req, res) => {
  const settlementId = Number(req.params.settlementId)
  const db = readDb()
  if (!Array.isArray(db.settlements)) db.settlements = []

  const beforeCount = db.settlements.length
  db.settlements = db.settlements.filter((item) => item.id !== settlementId)

  if (db.settlements.length === beforeCount) {
    return res.status(404).json({
      success: false,
      message: '입금 내역을 찾을 수 없습니다.',
    })
  }

  writeDb(db)

  res.json({
    success: true,
    message: '입금 내역이 삭제되었습니다.',
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
  const rows = [['매장', '일시', '품목', '수량', '단가', '합계']]
  const orders = db.orders.map((order) => enrichOrder(db, order))

  aggregateOrdersByStoreDate(orders).forEach((group) => {
    const items = aggregateApprovedRows(group.orders)

    items.forEach((item, index) => {
      rows.push([
        index === 0 ? group.storeName : '',
        index === 0 ? group.date : '',
        item.productName,
        `${item.quantity}개`,
        formatNumber(item.price),
        formatNumber(item.amount),
      ])
    })
  })

  const csv = `\uFEFF${rows
    .map((row) => row.map((cell) => csvCell(cell)).join(','))
    .join('\n')}`

  res.setHeader('Content-Type', 'text/csv;charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="stockmate_orders.csv"')
  res.send(csv)
})

app.get('/api/export/settlement.xls', (req, res) => {
  const db = readDb()
  const range = currentMonthRange()
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from)) ? String(req.query.from) : range.from
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to)) ? String(req.query.to) : range.to
  const orders = db.orders
    .map((order) => enrichOrder(db, order))
    .filter((order) => {
      const date = orderDateValue(order)
      return order.approvedTotal > 0 && date >= from && date <= to
    })
  const rows = []
  let grandPrevious = 0
  let grandOrder = 0
  let grandPaid = 0
  let grandBalance = 0

  db.stores.forEach((store) => {
    const storeOrders = orders.filter((order) => order.storeId === store.id)
    const itemRows = aggregateApprovedRows(storeOrders)
    const previousBalance = Math.max(
      0,
      storeAmountBeforeDate(db, store.id, from) - storePaidBeforeDate(db, store.id, from),
    )
    const orderAmount = storeOrders.reduce((sum, order) => sum + orderSupplyAmount(order), 0)
    const paidAmount = storePaidInRange(db, store.id, from, to)
    const balance = Math.max(0, previousBalance + orderAmount - paidAmount)

    grandPrevious += previousBalance
    grandOrder += orderAmount
    grandPaid += paidAmount
    grandBalance += balance

    let storePrinted = false
    let lastDate = ''
    itemRows.forEach((item) => {
      const showDate = item.date !== lastDate
      rows.push(`
        <tr>
          <td>${storePrinted ? '' : escapeHtml(store.name)}</td>
          <td>${showDate ? escapeHtml(item.date) : ''}</td>
          <td>${escapeHtml(item.productName)}</td>
          <td class="num">${formatNumber(item.quantity)}</td>
          <td class="num">${formatNumber(item.price)}</td>
          <td class="num">${formatNumber(item.amount)}</td>
        </tr>
      `)
      storePrinted = true
      lastDate = item.date
    })

    rows.push(`
      <tr class="store-total">
        <td colspan="3">${escapeHtml(store.name)} 소계</td>
        <td></td>
        <td>이전 미수 ${formatNumber(previousBalance)} / 입금 ${formatNumber(paidAmount)}</td>
        <td class="num">총합계 ${formatNumber(balance)}</td>
      </tr>
    `)
  })

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Apple SD Gothic Neo, Malgun Gothic, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #999; padding: 7px; font-size: 13px; }
          th { background: #f1f3f5; font-weight: 800; text-align: center; }
          .title { font-size: 22px; font-weight: 900; text-align: center; border: 2px solid #0f7a3b; }
          .period { text-align: center; font-size: 16px; border: 0; padding: 18px 0 6px; }
          .num { text-align: right; }
          .store-total, .grand-total { font-weight: 900; background: #f8f9fa; }
        </style>
      </head>
      <body>
        <table>
          <tbody>
            <tr><td class="title" colspan="6">한우면우촌리 정산서</td></tr>
            <tr><td class="period" colspan="6">${escapeHtml(from)} ~ ${escapeHtml(to)}</td></tr>
            <tr>
              <th>매장</th>
              <th>날짜</th>
              <th>품목</th>
              <th>수량</th>
              <th>단가</th>
              <th>합계</th>
            </tr>
            ${rows.join('') || '<tr><td colspan="6">정산 내역이 없습니다.</td></tr>'}
            <tr class="grand-total">
              <td colspan="3">전체 합계</td>
              <td></td>
              <td>미수 ${formatNumber(grandPrevious)} / 기간주문 ${formatNumber(grandOrder)} / 입금 ${formatNumber(grandPaid)}</td>
              <td class="num">${formatNumber(grandBalance)}</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  `

  res.setHeader('Content-Type', 'application/vnd.ms-excel;charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="settlement_${from}_${to}.xls"`)
  res.send(`\uFEFF${html}`)
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
