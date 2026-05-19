// app.js

document.addEventListener('DOMContentLoaded', () => {
    let masterData = [];
    let activeRowIndex = -1;

    const loadJsonInput = document.getElementById('loadJsonInput');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    
    // Core Triggers
    window.calcTrigger = () => calculateAll();
    
    document.getElementById('addBomBtn').addEventListener('click', () => addBomRow());
    document.getElementById('addLaborBtn').addEventListener('click', () => addLaborRow());
    document.getElementById('addOhBtn').addEventListener('click', () => addOhRow());
    
    document.querySelectorAll('.calc-trigger').forEach(el => {
        el.addEventListener('input', window.calcTrigger);
    });

    loadJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                masterData = JSON.parse(evt.target.result);
                // Initialize default cost structures for each row if not present
                masterData.forEach(row => {
                    if (!row.costBuilder) {
                        row.costBuilder = {
                            bom: [], labor: [], oh: [],
                            yield: row["Quantity"] || 100,
                            price: row["Price / Unit"] || 0.00
                        };
                    }
                });
                renderDataGrid();
            } catch (err) {
                alert("Invalid JSON format.");
            }
        };
        reader.readAsText(file);
    });

    exportExcelBtn.addEventListener('click', () => {
        let html = "<html xmlns:x='urn:schemas-microsoft-com:office:excel'><head><meta charset='utf-8'></head><body>";
        html += document.getElementById('masterDataGrid').outerHTML;
        html += "</body></html>";
        let blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        let a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `VilBooks_Production_Schedule.xls`;
        a.click();
    });

    function renderDataGrid() {
        const tbody = document.querySelector('#masterDataGrid tbody');
        tbody.innerHTML = '';
        masterData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.onclick = () => selectRow(index, tr);
            
            // Build Integrated Notes
            let integratedNotes = row["Notes"] || "";
            if (row.costBuilder) {
                const combinedBuilderNotes = [
                    ...row.costBuilder.bom.map(i => i.note),
                    ...row.costBuilder.labor.map(i => i.note),
                    ...row.costBuilder.oh.map(i => i.note)
                ].filter(n => n && n.trim() !== "").join(" | ");
                if (combinedBuilderNotes) {
                    integratedNotes += (integratedNotes ? " | " : "") + combinedBuilderNotes;
                }
            }

            tr.innerHTML = `
                <td>${row["WO"] || ''}</td>
                <td>${row["Item Number"] || ''}</td>
                <td>${row["Item Description"] || ''}</td>
                <td>${row["Quantity"] || ''}</td>
                <td>${row["Start"] || ''}</td>
                <td>${row["Due"] || ''}</td>
                <td>${row["Cust Code"] || ''}</td>
                <td>${integratedNotes}</td>
                <td>${row["Std Cost / Unit"] || '0.00'}</td>
                <td>${row["Cost x QTY"] || '0.00'}</td>
                <td>${row["Profit"] || '0.00'}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    function selectRow(index, trElement) {
        if (activeRowIndex >= 0) saveBuilderStateToRow(activeRowIndex); // Save prev state

        activeRowIndex = index;
        document.querySelectorAll('#masterDataGrid tbody tr').forEach(tr => tr.classList.remove('selected'));
        trElement.classList.add('selected');
        
        const row = masterData[index];
        document.getElementById('activeRowIndicator').innerText = `Active WO: ${row["WO"]} | Item: ${row["Item Number"]}`;
        
        loadBuilderStateFromRow(row);
        calculateAll();
    }

    // --- DOM Builders ---
    window.removeRow = (btn) => {
        btn.closest('tr').remove();
        window.calcTrigger();
    };

    function addBomRow(name = "", qty = 0, cost = 0, comp = 100, note = "") {
        const tr = document.createElement('tr');
        tr.className = 'bom-row';
        tr.innerHTML = `
            <td><button class="btn-del" onclick="window.removeRow(this)">-</button></td>
            <td><input type="text" class="b-item" value="${name}" oninput="window.calcTrigger()"></td>
            <td><input type="number" class="b-qty calc-trigger" value="${qty}"></td>
            <td><input type="number" class="b-cost calc-trigger" value="${cost}"></td>
            <td class="calc-cell b-total">0.00</td>
            <td><input type="number" class="b-comp calc-trigger" value="${comp}" max="100" min="0"></td>
            <td class="calc-cell b-wip">0.00</td>
            <td><input type="text" class="note-input b-note" value="${note}" oninput="window.calcTrigger()"></td>
        `;
        document.getElementById('bom-tbody').appendChild(tr);
        addTriggerListeners(tr);
    }

    function addLaborRow(name = "", hrs = 0, rate = 0, comp = 100, note = "") {
        const tr = document.createElement('tr');
        tr.className = 'labor-row';
        tr.innerHTML = `
            <td><button class="btn-del" onclick="window.removeRow(this)">-</button></td>
            <td><input type="text" class="l-item" value="${name}" oninput="window.calcTrigger()"></td>
            <td><input type="number" class="l-hrs calc-trigger" value="${hrs}"></td>
            <td><input type="number" class="l-rate calc-trigger" value="${rate}"></td>
            <td class="calc-cell l-total">0.00</td>
            <td><input type="number" class="l-comp calc-trigger" value="${comp}" max="100" min="0"></td>
            <td class="calc-cell l-wip">0.00</td>
            <td><input type="text" class="note-input l-note" value="${note}" oninput="window.calcTrigger()"></td>
        `;
        document.getElementById('labor-tbody').appendChild(tr);
        addTriggerListeners(tr);
    }

    function addOhRow(name = "", hrs = 0, rate = 0, comp = 100, note = "") {
        const tr = document.createElement('tr');
        tr.className = 'oh-row';
        tr.innerHTML = `
            <td><button class="btn-del" onclick="window.removeRow(this)">-</button></td>
            <td><input type="text" class="o-item" value="${name}" oninput="window.calcTrigger()"></td>
            <td><input type="number" class="o-hrs calc-trigger" value="${hrs}"></td>
            <td><input type="number" class="o-rate calc-trigger" value="${rate}"></td>
            <td class="calc-cell o-total">0.00</td>
            <td><input type="number" class="o-comp calc-trigger" value="${comp}" max="100" min="0"></td>
            <td class="calc-cell o-wip">0.00</td>
            <td><input type="text" class="note-input o-note" value="${note}" oninput="window.calcTrigger()"></td>
        `;
        document.getElementById('overhead-tbody').appendChild(tr);
        addTriggerListeners(tr);
    }

    function addTriggerListeners(tr) {
        tr.querySelectorAll('.calc-trigger').forEach(el => el.addEventListener('input', window.calcTrigger));
    }

    // --- State Management ---
    function loadBuilderStateFromRow(row) {
        document.getElementById('bom-tbody').innerHTML = '';
        document.getElementById('labor-tbody').innerHTML = '';
        document.getElementById('overhead-tbody').innerHTML = '';
        
        const cb = row.costBuilder;
        if (cb.bom.length === 0) addBomRow(); else cb.bom.forEach(i => addBomRow(i.name, i.qty, i.cost, i.comp, i.note));
        if (cb.labor.length === 0) addLaborRow(); else cb.labor.forEach(i => addLaborRow(i.name, i.hrs, i.rate, i.comp, i.note));
        if (cb.oh.length === 0) addOhRow(); else cb.oh.forEach(i => addOhRow(i.name, i.hrs, i.rate, i.comp, i.note));
        
        document.getElementById('p_yield').value = cb.yield;
        document.getElementById('p_price').value = cb.price;
    }

    function saveBuilderStateToRow(index) {
        if (!masterData[index]) return;
        const cb = { bom: [], labor: [], oh: [], yield: 0, price: 0 };
        
        document.querySelectorAll('.bom-row').forEach(r => cb.bom.push({
            name: r.querySelector('.b-item').value, qty: r.querySelector('.b-qty').value, cost: r.querySelector('.b-cost').value, comp: r.querySelector('.b-comp').value, note: r.querySelector('.b-note').value
        }));
        document.querySelectorAll('.labor-row').forEach(r => cb.labor.push({
            name: r.querySelector('.l-item').value, hrs: r.querySelector('.l-hrs').value, rate: r.querySelector('.l-rate').value, comp: r.querySelector('.l-comp').value, note: r.querySelector('.l-note').value
        }));
        document.querySelectorAll('.oh-row').forEach(r => cb.oh.push({
            name: r.querySelector('.o-item').value, hrs: r.querySelector('.o-hrs').value, rate: r.querySelector('.o-rate').value, comp: r.querySelector('.o-comp').value, note: r.querySelector('.o-note').value
        }));
        
        cb.yield = parseFloat(document.getElementById('p_yield').value) || 0;
        cb.price = parseFloat(document.getElementById('p_price').value) || 0;
        
        masterData[index].costBuilder = cb;
        // Update Grid Level numbers
        const batchTot = parseFloat(document.getElementById('s_batch_cost').innerText.replace('$','')) || 0;
        const unitCost = parseFloat(document.getElementById('s_unit_cost').innerText.replace('$','')) || 0;
        const profit = parseFloat(document.getElementById('s_profit').innerText.replace('$','')) || 0;
        
        masterData[index]["Std Cost / Unit"] = unitCost.toFixed(4);
        masterData[index]["Cost x QTY"] = batchTot.toFixed(2);
        masterData[index]["Profit"] = profit.toFixed(2);
    }

    // --- Core Calculation ---
    function calculateAll() {
        if (activeRowIndex < 0) return;

        let totalBom = 0, totalBomWip = 0;
        let journalLines = [];

        // BOM
        document.querySelectorAll('.bom-row').forEach(r => {
            const q = parseFloat(r.querySelector('.b-qty').value) || 0;
            const c = parseFloat(r.querySelector('.b-cost').value) || 0;
            const comp = (parseFloat(r.querySelector('.b-comp').value) || 0) / 100;
            const item = r.querySelector('.b-item').value;
            const tot = q * c; const wip = tot * comp;
            totalBom += tot; totalBomWip += wip;
            r.querySelector('.b-total').innerText = tot.toFixed(2);
            r.querySelector('.b-wip').innerText = wip.toFixed(2);
            if (wip > 0 && item) journalLines.push({ account: `Inventory Asset: ${item}`, debit: 0, credit: wip, memo: `Applied Material: ${q} units @ $${c}`});
        });
        document.getElementById('bom_cost_total').innerText = `$${totalBom.toFixed(2)}`;
        document.getElementById('bom_wip_total').innerText = `$${totalBomWip.toFixed(2)}`;

        // Labor
        let totalLab = 0, totalLabWip = 0;
        document.querySelectorAll('.labor-row').forEach(r => {
            const h = parseFloat(r.querySelector('.l-hrs').value) || 0;
            const rate = parseFloat(r.querySelector('.l-rate').value) || 0;
            const comp = (parseFloat(r.querySelector('.l-comp').value) || 0) / 100;
            const item = r.querySelector('.l-item').value;
            const tot = h * rate; const wip = tot * comp;
            totalLab += tot; totalLabWip += wip;
            r.querySelector('.l-total').innerText = tot.toFixed(2);
            r.querySelector('.l-wip').innerText = wip.toFixed(2);
            if (wip > 0 && item) journalLines.push({ account: `Direct Labor Applied: ${item}`, debit: 0, credit: wip, memo: `Applied Labor: ${h} hrs @ $${rate}`});
        });
        document.getElementById('labor_cost_total').innerText = `$${totalLab.toFixed(2)}`;
        document.getElementById('labor_wip_total').innerText = `$${totalLabWip.toFixed(2)}`;

        // Overhead
        let totalOh = 0, totalOhWip = 0;
        document.querySelectorAll('.oh-row').forEach(r => {
            const h = parseFloat(r.querySelector('.o-hrs').value) || 0;
            const rate = parseFloat(r.querySelector('.o-rate').value) || 0;
            const comp = (parseFloat(r.querySelector('.o-comp').value) || 0) / 100;
            const item = r.querySelector('.o-item').value;
            const tot = h * rate; const wip = tot * comp;
            totalOh += tot; totalOhWip += wip;
            r.querySelector('.o-total').innerText = tot.toFixed(2);
            r.querySelector('.o-wip').innerText = wip.toFixed(2);
            if (wip > 0 && item) journalLines.push({ account: `Factory Overhead Applied: ${item}`, debit: 0, credit: wip, memo: `Applied Overhead: ${h} drivers @ $${rate}`});
        });
        document.getElementById('oh_cost_total').innerText = `$${totalOh.toFixed(2)}`;
        document.getElementById('oh_wip_total').innerText = `$${totalOhWip.toFixed(2)}`;

        // Summary
        const batchTot = totalBom + totalLab + totalOh;
        const batchWipTot = totalBomWip + totalLabWip + totalOhWip;
        const pYield = parseFloat(document.getElementById('p_yield').value) || 1;
        const pPrice = parseFloat(document.getElementById('p_price').value) || 0;

        document.getElementById('s_batch_cost').innerText = `$${batchTot.toFixed(2)}`;
        const unitCost = pYield > 0 ? (batchTot / pYield) : 0;
        document.getElementById('s_unit_cost').innerText = `$${unitCost.toFixed(4)}`;
        const profit = (pPrice * pYield) - batchTot;
        document.getElementById('s_profit').innerText = `$${profit.toFixed(2)}`;

        saveBuilderStateToRow(activeRowIndex);
        renderDataGrid(); // Refresh grid notes/totals
        
        // Render Journal
        const jBody = document.querySelector('#journalTable tbody');
        jBody.innerHTML = '';
        if (batchWipTot > 0) {
            const rowData = masterData[activeRowIndex];
            const fgAccount = `Finished Goods: ${rowData["Item Number"]}`;
            jBody.innerHTML += `<tr><td><strong>${fgAccount}</strong></td><td style="text-align:right; font-weight:bold; color:var(--btn-bg);">${batchWipTot.toFixed(2)}</td><td style="text-align:right;">0.00</td><td>Standard Cost Build: WO ${rowData["WO"]}</td></tr>`;
            
            journalLines.forEach(line => {
                jBody.innerHTML += `<tr><td>${line.account}</td><td style="text-align:right;">0.00</td><td style="text-align:right;">${line.credit.toFixed(2)}</td><td>${line.memo}</td></tr>`;
            });
        } else {
            jBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: #666;">No costs applied yet.</td></tr>`;
        }
    }
});
