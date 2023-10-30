let db;
let dbVersion = 2;

//delete db (for testing)

// let deleteRequest = indexedDB.deleteDatabase('money');
// deleteRequest.onsuccess = function () {
//     console.log('deleted');
//     console.log(deleteRequest);
// }

let openRequest = indexedDB.open('money', dbVersion);

openRequest.onupgradeneeded = function(event) {
    db = openRequest.result;
    switch (event.oldVersion) {
        case 0:
            const invests = db.createObjectStore('invests', {keyPath: 'id', autoIncrement: true});
            invests.createIndex('isActiveIdx', 'isActive', {unique: false});

            const payments = db.createObjectStore('payments', {keyPath: 'id', autoIncrement: true});
            payments.createIndex('investIdIdx', 'investId', {unique: false});
            break;
    }
};

openRequest.onerror = function() {
    console.error("Error", openRequest.error);
};

openRequest.onsuccess = function() {
    db = openRequest.result;

    db.onversionchange = function() {
        db.close();
        alert("Db is outdated, refresh the page");
    };

    main();
}

async function main() {
    await dbCalculatePayments();
    await updatePayments();
}

async function updatePayments() {
    let filterOnlyActive = document.getElementById('filter-show-all').checked ? 0 : 1;
    let filterSkipPayed = document.getElementById('filter-skip-payed').checked;
    let invests = await dbGetInvests({filterOnlyActive: filterOnlyActive});

    let dataListElem= document.getElementById('data-list');
    dataListElem.innerHTML = '';

    if (!invests) {
        return;
    }

    const today = new Date();
    let totalInvestedMoney = 0;
    let totalDebtMoney = 0;

    for (const invest of invests) {
        if (invest.isActive) {
            totalInvestedMoney += invest.money;
        }

        let investItem = renderInvestItem(invest);
        dataListElem.appendChild(investItem);

        let payments = await dbGetPayments(invest.id);
        for (let payment of payments) {
            let isDebt = false;
            if (filterSkipPayed && payment.isPayed) {
                continue;
            }
            if (!payment.isPayed && payment.paymentDate < today) {
                isDebt = true;
                totalDebtMoney += payment.money;
            }
            let paymentItem = renderPaymentItem(payment, isDebt);
            dataListElem.appendChild(paymentItem);
        }
    }

    let total = {createdDate: 'Total invest', closedDate: null, money: totalInvestedMoney, isActive: 0};
    let totalItem = renderInvestItem(total);
    dataListElem.appendChild(totalItem);

    if (totalDebtMoney > 0) {
        let totalDebt = {paymentDate: 'Total debt', closedDate: null, money: totalDebtMoney, isPayed: 1};
        let totalDebtItem = renderPaymentItem(totalDebt, true);
        dataListElem.appendChild(totalDebtItem);
    }
}

function renderInvestItem(invest) {
    let dataItem =  document.createElement('div');
    dataItem.className = 'invest-item';

    let dataItemCreatedDate = document.createElement('div');
    dataItemCreatedDate.className = 'invest-date';
    dataItemCreatedDate.innerHTML = formatDate(invest.createdDate);
    dataItem.appendChild(dataItemCreatedDate);

    let dataItemClosedDate = document.createElement('div');
    dataItemClosedDate.className = 'invest-date';
    dataItemClosedDate.innerHTML = formatDate(invest.closedDate);
    dataItem.appendChild(dataItemClosedDate);

    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'invest-money';
    dataItemMoney.innerHTML = formatMoney(invest.money);
    dataItem.appendChild(dataItemMoney);

    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'invest-close';

    if (invest.isActive == 1) {
        let closeButton = document.createElement('button');
        closeButton.className = 'invest-close-button';
        closeButton.innerHTML = 'X';
        closeButton.setAttribute('investId', invest.id);
        closeButton.addEventListener('click', closeInvest)
        dataItemClose.appendChild(closeButton);
    }

    dataItem.appendChild(dataItemClose);

    return dataItem;
}

function renderPaymentItem(payment, isDebt) {
    let dataItem =  document.createElement('div');
    dataItem.className = 'payment-item';

    if (isDebt) {
        dataItem.classList.add('debt');
    }

    let dataItemFiller = document.createElement('div');
    dataItemFiller.innerHTML = '&nbsp;'
    dataItem.appendChild(dataItemFiller);

    let dataItemPaymentDate = document.createElement('div');
    dataItemPaymentDate.className = 'payment-date';
    dataItemPaymentDate.innerHTML = formatDate(payment.paymentDate);
    dataItem.appendChild(dataItemPaymentDate);

    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'payment-money';
    dataItemMoney.innerHTML = formatMoney(payment.money);
    dataItem.appendChild(dataItemMoney);

    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'payment-close';

    if (payment.isPayed == 0) {
        let payedButton = document.createElement('button');
        payedButton.className = 'payment-close-button';
        payedButton.innerHTML = '✓';
        payedButton.setAttribute('paymentId', payment.id);
        payedButton.addEventListener('click', closePayment)
        dataItemClose.appendChild(payedButton);
    }

    dataItem.appendChild(dataItemClose);

    return dataItem;
}

async function addInvest(e) {
    if (e.preventDefault) e.preventDefault();

    let money = document.getElementById('add-invest-money').value;
    let createdDate = document.getElementById('add-invest-date').value;

    if (!money || !createdDate) {
        return;
    }

    money = parseFloat(money);
    createdDate = new Date(Date.parse(createdDate));

    let res = await dbAddInvest(money, createdDate);
    if (res !== undefined) {
        document.getElementById('add-invest-form').reset();
        toast('Invest added');
    } else {
        toast(res, true);
    }

    await dbCalculatePayments();
    await updatePayments();
}

async function closeInvest() {
    let investId = this.getAttribute('investId');
    investId = parseInt(investId);
    if (!investId) {
        return;
    }

    let res = await dbCloseInvest(investId);
    if (res !== undefined) {
        toast('Invest closed');
    } else {
        toast(res, true);
    }

    await updatePayments();
}

async function closePayment() {
    let paymentId = this.getAttribute('paymentId');
    paymentId = parseInt(paymentId);
    if (!paymentId) {
        return;
    }

    let res = await dbClosePayment(paymentId);
    if (res !== undefined) {
        toast('Payment closed');
    } else {
        toast(res, true);
    }

    await dbCalculatePayments();
    await updatePayments();
}

function formatDate(date) {
    if (!date) {
        return '&nbsp;';
    }

    if (!(date instanceof Date)) {
        return date;
    }

    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    if (month < 10) month = '0' + month;
    let day = date.getDate();
    if (day < 10) day = '0' + day;

    return `${year}-${month}-${day}`;
}

let moneyFormatter = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    useGrouping: true,
    maximumSignificantDigits: 9,
});

function formatMoney(money) {
    return moneyFormatter.format(money);
}

function toast(text, isError) {
    isError = isError || false;
    Toastify({
        text: text,
        duration: 2000,
        gravity: "top",
        position: "center",
        style: {
            background: isError ? '#AF4C50' : '#4CAF50',
        }
    }).showToast();
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('filter-show-all').addEventListener("click", updatePayments);
    document.getElementById('filter-skip-payed').addEventListener("click", updatePayments);
    document.getElementById('add-invest-form').addEventListener('submit', addInvest)
});