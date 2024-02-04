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
    switch (event.newVersion) {
        case 2:
            if (!db.objectStoreNames.contains('invests')) {
                const invests = db.createObjectStore('invests', {keyPath: 'id', autoIncrement: true});
                invests.createIndex('isActiveIdx', 'isActive', {unique: false});
            }

            if (!db.objectStoreNames.contains('payments')) {
                const payments = db.createObjectStore('payments', {keyPath: 'id', autoIncrement: true});
                payments.createIndex('investIdIdx', 'investId', {unique: false});
            }
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

    invests.sort((a, b) => {
        let dayA = a.createdDate.getDate();
        let dayB = b.createdDate.getDate();

        return dayA - dayB;
    });

    let dataListElem= document.getElementById('data-list');
    dataListElem.innerHTML = '';

    if (!invests) {
        return;
    }

    const today = new Date();
    let totalInvestedMoney = 0;
    let totalDebtMoney = 0;
    let i = 0;
    let curDateLineDrawn = false;

    for (const invest of invests) {
        i++;

        if (invest.isActive) {
            totalInvestedMoney += invest.money;
        }

        if (!curDateLineDrawn && today.getDate() < invest.createdDate.getDate()) {
            curDateLineDrawn = true;
            dataListElem.appendChild(renderCurDateLine());
        }

        let investItem = renderInvestItem(invest, i);
        dataListElem.appendChild(investItem);

        let payments = await dbGetPayments({id: invest.id});
        for (let payment of payments) {
            let isDebt = false;
            if (filterSkipPayed && payment.isPayed) {
                continue;
            }
            if (!payment.isPayed && payment.paymentDate < today) {
                isDebt = true;
                totalDebtMoney += payment.money;
            }
            let paymentItem = renderPaymentItem(payment, isDebt, i);
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

function renderCurDateLine() {
    let dataItem =  document.createElement('div');
    dataItem.className = 'cur-date-item';

    return dataItem;
}

function renderInvestItem(invest, index) {
    let dataItem =  document.createElement('div');
    dataItem.className = 'data-item invest-item';
    if (index != undefined && (index % 2)) {
        dataItem.classList.add('odd')
    }

    let dataItemCreatedDate = document.createElement('div');
    dataItemCreatedDate.className = 'item-date';
    dataItemCreatedDate.innerHTML = formatDate(invest.createdDate);
    dataItem.appendChild(dataItemCreatedDate);

    let dataItemClosedDate = document.createElement('div');
    dataItemClosedDate.className = 'item-date';
    dataItemClosedDate.innerHTML = formatDate(invest.closedDate);
    dataItem.appendChild(dataItemClosedDate);

    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'item-money';
    dataItemMoney.innerHTML = formatMoney(invest.money);
    dataItem.appendChild(dataItemMoney);

    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'item-actions';

    if (invest.isActive == 1) {
        let closeButton = document.createElement('button');
        closeButton.className = 'invest-close-button';
        closeButton.innerHTML = 'X';
        closeButton.title = 'Close investment';
        closeButton.setAttribute('investId', invest.id);
        closeButton.addEventListener('click', closeInvest)
        dataItemClose.appendChild(closeButton);
    } else if (invest.closedDate) {
        dataItem.classList.add('closed');
    }

    dataItem.appendChild(dataItemClose);

    return dataItem;
}

function renderPaymentItem(payment, isDebt, index) {
    let dataItem =  document.createElement('div');
    dataItem.className = 'data-item payment-item';

    if (isDebt) {
        dataItem.classList.add('debt');
    }

    if (index != undefined && (index % 2)) {
        dataItem.classList.add('odd')
    }

    let dataItemFiller = document.createElement('div');
    dataItemFiller.innerHTML = '&nbsp;'
    dataItem.appendChild(dataItemFiller);

    let dataItemPaymentDate = document.createElement('div');
    dataItemPaymentDate.className = 'item-date';
    dataItemPaymentDate.innerHTML = formatDate(payment.paymentDate);
    dataItem.appendChild(dataItemPaymentDate);

    let dataItemMoney = document.createElement('div');
    dataItemMoney.className = 'item-money';
    dataItemMoney.innerHTML = formatMoney(payment.money);
    dataItem.appendChild(dataItemMoney);

    let dataItemClose = document.createElement('div');
    dataItemClose.className = 'item-actions';

    if (payment.isPayed == 0) {
        let payedButton = document.createElement('button');
        payedButton.className = 'payment-close-button';
        payedButton.innerHTML = '✓';
        payedButton.title = 'Approve payment';
        payedButton.setAttribute('paymentId', payment.id);
        payedButton.addEventListener('click', closePayment)
        dataItemClose.appendChild(payedButton);
    } else {
        dataItem.classList.add("payed");
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

    let payments = await dbGetPayments({id: investId});
    for (let payment of payments) {
        if (!payment.isPayed) {
            let res = await dbClosePayment(payment.id);
            if (res !== undefined) {
                toast('Unpdayed payment closed');
            } else {
                toast(res, true);
            }
        }
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

async function exportData() {
    let invests = await dbGetInvests();
    let payments = await dbGetPayments();

    let exportString = JSON.stringify({invests: invests, payments: payments});
    try {
        await navigator.clipboard.writeText(exportString);
        toast('Export data copied to clipboard');
    } catch (err) {
        toast('Failed to copy export data to clipboard', true);
    }
}

async function importData() {
    let importJson = prompt('Input JSON to import (IT WILL ERASE ALL CURRENT DATA!!)');
    if (!importJson) {
        return;
    }
    try {
        let importData = JSON.parse(importJson);
        dbImportData(importData);
        toast('Import success');
        setTimeout(() => document.location.reload(), 1000);
    } catch (err) {
        toast('Failed to parse JSON', true);
    }
}

function formatDate(date) {
    if (!date) {
        return '&nbsp;';
    }

    if (!(date instanceof Date)) {
        return date;
    }

    let year = date.getFullYear();
    let month = date.toLocaleString('default', { month: 'short' }).replace('.', '');
    let day = date.getDate();
    if (day < 10) day = '0' + day;

    return `${year}-${month}-${day}`;
}

let moneyFormatter = new Intl.NumberFormat('default', {
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
    document.getElementById('invest-export').addEventListener('click', exportData)
    document.getElementById('invest-import').addEventListener('click', importData)
});
