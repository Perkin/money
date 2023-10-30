let incomePart = 0.05;

async function dbGetInvestById(investId) {
    let transaction = db.transaction("invests");
    let invests = transaction.objectStore("invests");

    return dbDoAsync (() => invests.get(investId));
}

async function dbGetInvests(filters) {
    let filterOnlyActive = filters.filterOnlyActive;

    let transaction = db.transaction("invests");
    let invests = transaction.objectStore("invests");

    if (filterOnlyActive) {
        let showAllIndex = invests.index('isActiveIdx');
        return dbDoAsync(() => showAllIndex.getAll(filterOnlyActive));
    } else {
        return dbDoAsync (() => invests.getAll());
    }
}

async function dbAddInvest(money, createdDate) {
    let transaction = db.transaction("invests", "readwrite");

    let invests = transaction.objectStore("invests");
    let invest = {
        money: money,
        createdDate: createdDate,
        closedDate: null,
        isActive: 1,
    };

    return dbDoAsync(() => invests.add(invest));
}

async function dbCloseInvest(investId){
    let invest = await dbGetInvestById(investId);
    invest.isActive = 0;
    invest.closedDate = new Date();

    let transaction = db.transaction("invests", "readwrite");
    let invests = transaction.objectStore("invests");

    return dbDoAsync(() => invests.put(invest));
}

async function dbCalculatePayments() {
    let invests = await dbGetInvests({filterOnlyActive: 1});
    if (!invests) {
        return;
    }

    for(const invest of invests) {
        let lastPaymentDate = invest.createdDate;

        let payments = await dbGetPayments(invest.id);
        let lastPayment = payments.pop();

        // Keep the last unpayed row active
        if (lastPayment && !lastPayment.isPayed) {
            continue;
        }

        if (lastPayment) {
            lastPaymentDate = lastPayment.paymentDate;
        }

        lastPaymentDate.setMonth(lastPaymentDate.getMonth() + 1);

        await dbAddPayment(invest.id, invest.money, lastPaymentDate);
    }
}

async function dbGetPayments(investId) {
    let transaction = db.transaction("payments");
    let payments = transaction.objectStore("payments");

    let investIndex = payments.index('investIdIdx');
    return dbDoAsync(() => investIndex.getAll(investId));
}

async function dbAddPayment(investId, investMoney, paymentDate) {
    let transaction = db.transaction("payments", "readwrite");
    let payments = transaction.objectStore("payments");

    let payment = {
        investId: investId,
        money: Math.round(investMoney * incomePart),
        paymentDate: paymentDate,
        isPayed: 0,
    }

    return dbDoAsync(() => payments.add(payment));
}

async function dbClosePayment(paymentId){
    let payment = await dbGetPaymentById(paymentId);
    payment.isPayed = 1;

    let transaction = db.transaction("payments", "readwrite");
    let payments = transaction.objectStore("payments");

    return dbDoAsync(() => payments.put(payment));
}

async function dbGetPaymentById(paymentId) {
    let transaction = db.transaction("payments");
    let payments = transaction.objectStore("payments");

    return dbDoAsync (() => payments.get(paymentId));
}

async function dbDoAsync(callback) {
    return new Promise((resolve, reject) => {
        let request = callback();

        request.onsuccess = function () {
            resolve(request.result);
        };

        request.onerror = function () {
            let caller = (new Error()).stack.split("\n")[4].trim().split(" ")[1];
            console.log(`${caller}: failed`, request.error);
            reject(request.error);
        };
    });
}
