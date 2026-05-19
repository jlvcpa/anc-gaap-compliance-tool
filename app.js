// app.js

document.addEventListener('DOMContentLoaded', () => {
    let masterData = [];
    let activeRowIndex = -1;
    let activeRowRef = null;
    let lastPriceMode = 'price'; 

    const loadJsonInput = document.getElementById('loadJsonInput');
    const saveJsonBtn = document.getElementById('saveJsonBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const addNewBatchBtn = document.getElementById('addNewBatchBtn');
    const pYieldInput = document.getElementById('p_yield');
    const pMarginInput = document.getElementById('p_margin');
    const pPriceInput = document.getElementById('p_price');
    
    window.calcTrigger = () => calculateAll();
    
    document.getElementById('addBomBtn').addEventListener('click', () => addBomRow());
    document.getElementById('addLaborBtn').addEventListener('click', () => addLaborRow());
    document.getElementById('addOhBtn').addEventListener('click', () => addOhRow());
    
    pYieldInput.addEventListener('input', (e) => {
        if (activeRowIndex >= 0) {
            masterData[activeRowIndex]["Quantity"] = parseFloat(e.target.value) || 0;
            renderDataGrid();
            calculateAll();
        }
    });

    pMarginInput.addEventListener('input', () => {
        lastPriceMode = 'margin';
        window.calcTrigger();
    });

    pPriceInput.addEventListener('input', () => {
        lastPriceMode = 'price';
        window.calcTrigger();
    });

    loadJsonInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                masterData = JSON.parse(evt.target.result);
                masterData.forEach(row => {
                    if (!row.costBuilder) {
                        row.costBuilder = { bom: [], labor: [], oh: [], yield: row["Quantity"] || 100, price: row["Price / Unit"] || 0.00 };
                    }
                });
                activeRowIndex = -1;
                activeRowRef = null;
                clearBuilder();
                sortMasterData();
                renderDataGrid();
            } catch (err) {
                alert("Invalid JSON format.");
            }
        };
        reader.readAsText(file);
        e.target.value = ''; 
    });

    saveJsonBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(masterData, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "WO_Production_Schedule_Master.json";
        a.click();
        URL.revokeObjectURL(url);
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

    function sortMasterData() {
        masterData.sort((a, b) => {
            let dateA = a["Start"] ? new Date(a["Start"]).getTime() : Infinity; 
            let dateB = b["Start"] ? new Date(b["Start"]).getTime() : Infinity; 
            
            if (dateA !== dateB) return dateB - dateA; 
            return (a["WO"] || "").localeCompare(b["WO"] || "");
        });
        if (activeRowRef) activeRowIndex = masterData.indexOf(activeRowRef);
    }

    addNewBatchBtn.addEventListener('click', () => {
        if (activeRowIndex >= 0) saveBuilderStateToRow(activeRowIndex); 

        const newBatch = {
            "WO": "NEW", "Dash": "1", "Item Number": "", "Item Description": "New Batch", 
            "Quantity": 100, "Status": "Staged", "Start": "", "Finish": "", "Due": "", 
            "Cust Code": "", "Notes": "", "Price / Unit": 0, "Units/Minute": "", "units/Hours": "",
            costBuilder: { bom: [], labor: [], oh: [], yield: 100, price: 0 }
        };
        
        masterData.push(newBatch); 
        activeRowRef = newBatch;
        sortMasterData(); 
        renderDataGrid();
        
        const newTr = document.querySelector(`#masterDataGrid tbody`).children[activeRowIndex];
        selectRow(activeRowIndex, newTr);
    });

    window.deleteRow = (index, event) => {
        event.stopPropagation();
        if(confirm("Are you sure you want to delete this batch?")) {
            masterData.splice(index, 1);
            if(activeRowIndex === index) {
                activeRowIndex = -1;
                activeRowRef = null;
                clearBuilder();
            } else if (activeRowIndex > index) {
                activeRowIndex--;
            }
            renderDataGrid();
        }
    };

    function formatDayDate(val) {
        if(!val) return '';
        if(val.includes(',')) return val; 
        const parts = val.split('-');
        if(parts.length === 3) {
            const d = new Date(parts[0], parts[1]-1, parts[2]); 
            const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            return `${days[d.getDay()]}, ${val}`;
        }
        return val;
    }

    function extractIsoDate(val) {
        if(!val) return '';
        if(val.includes(',')) return val.split(',')[1].trim();
        return val;
    }

    window.makeEditable = (index, field, value, type="text") => {
        let displayVal = value || '';
        let inputVal = value || '';
        
        if(type === 'date') {
            displayVal = formatDayDate(value);
            inputVal = extractIsoDate(value);
        }

        let editorHtml = '';
        if(type === 'status') {
            editorHtml = `
                <select class="editor" onblur="window.updateField(${index}, '${field}', this.value); this.parentElement.classList.remove('editing');">
                    <option value="Staged" ${value==='Staged'?'selected':''}>Staged</option>
                    <option value="Blended" ${value==='Blended'?'selected':''}>Blended</option>
                    <option value="Encapsulated" ${value==='Encapsulated'?'selected':''}>Encapsulated</option>
                    <option value="Complete" ${value==='Complete'?'selected':''}>Complete</option>
                    <option value=" " ${!value || value===' '?'selected':''}> </option>
                </select>`;
        } else {
            editorHtml = `<input type="${type}" class="editor" value="${inputVal}" onblur="window.updateField(${index}, '${field}', this.value); this.parentElement.classList.remove('editing');" onkeydown="if(event.key==='Enter') this.blur();">`;
        }

        return `
        <div class="editable-cell">
            <span class="val">${displayVal}</span>
            <span class="edit-icon" onclick="this.parentElement.classList.add('editing'); this.parentElement.querySelector('.editor').focus();">✏️</span>
            ${editorHtml}
        </div>`;
    };

    window.updateField = (index, field, val) => {
        masterData[index][field] = field === 'Quantity' || field === 'Price / Unit' ? (parseFloat(val) || 0) : val;
        
        if (index === activeRowIndex && field === 'Quantity') {
            pYieldInput.value = masterData[index][field];
            calculateAll();
        } else if (index === activeRowIndex && field === 'Price / Unit') {
            pPriceInput.value = masterData[index][field];
            lastPriceMode = 'price';
            calculateAll();
        } else if (field === 'Start' || field === 'WO') {
            if (activeRowIndex >= 0) saveBuilderStateToRow(activeRowIndex); 
            sortMasterData();
            renderDataGrid();
        } else {
            renderDataGrid();
        }
    };

    function renderDataGrid() {
        const tbody = document.querySelector('#masterDataGrid tbody');
        tbody.innerHTML = '';
        
        if(masterData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="21" style="text-align:center; padding: 20px; color: #666;">Load master.json or Add New Batch to populate grid.</td></tr>`;
            return;
        }

        masterData.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.onclick = (e) => {
                if(['INPUT', 'SELECT', 'BUTTON'].includes(e.target.tagName) || e.target.classList.contains('edit-icon')) return;
                selectRow(index, tr);
            };
            
            let integratedNotes = window.makeEditable(index, 'Notes', row["Notes"], 'text');
            if (row.costBuilder) {
                const combinedBuilderNotes = [
                    ...row.costBuilder.bom.map(i => i.note),
                    ...row.costBuilder.labor.map(i => i.note),
                    ...row.costBuilder.oh.map(i => i.note)
                ].filter(n => n && n.trim() !== "").join(" | ");
                
                if (combinedBuilderNotes) {
                    integratedNotes += ` <br><span style="color:#666; font-size:0.8em;">(Builder: ${combinedBuilderNotes})</span>`;
                }
            }

            let um = parseFloat(row["Units/Minute"]) || 0;
            let uh = parseFloat(row["units/Hours"]) || 0;
            if(!uh && um) uh = um * 60; 

            tr.innerHTML = `
                <td><button class="btn-del" onclick="window.deleteRow(${index}, event)">X</button></td>
                <td class="align-right">${window.makeEditable(index, 'WO', row["WO"])}</td>
                <td class="align-right">${window.makeEditable(index, 'Dash', row["Dash"])}</td>
                <td>${window.makeEditable(index, 'Item Number', row["Item Number"])}</td>
                <td>${window.makeEditable(index, 'Item Description', row["Item Description"])}</td>
                <td class="align-right" style="background: #FFF2CC;">${window.makeEditable(index, 'Quantity', row["Quantity"], 'number')}</td>
                <td>${window.makeEditable(index, 'Status', row["Status"], 'status')}</td>
                <td>${window.makeEditable(index, 'Start', row["Start"], 'date')}</td>
                <td>${window.makeEditable(index, 'Finish', row["Finish"], 'date')}</td>
                <td>${window.makeEditable(index, 'Due', row["Due"], 'date')}</td>
                <td>${window.makeEditable(index, 'Cust Code', row["Cust Code"])}</td>
                <td>${integratedNotes}</td>
                <td class="calc-cell align-right">${row["# People"] || 0}</td>
                <td>${row["Machine"] || ''}</td>
                <td class="align-right">${window.makeEditable(index, 'Units/Minute', row["Units/Minute"], 'number')}</td>
                <td class="align-right">${window.makeEditable(index, 'units/Hours', uh ? uh : row["units/Hours"], 'number')}</td>
                <td class="calc-cell align-right" style="color: #1E8449;">$${parseFloat(row["Std Cost / Unit"] || 0).toFixed(4)}</td>
                <td class="calc-cell align-right">$${parseFloat(row["Cost x QTY"] || 0).toFixed(2)}</td>
                <td class="align-right" style="background: #FFF2CC;">${window.makeEditable(index, 'Price / Unit', row["Price / Unit"], 'number')}</td>
                <td class="calc-cell align-right">$${parseFloat(row["Total Batch Sales"] || 0).toFixed(2)}</td>
                <td class="calc-cell align-right" style="color: #1E8449;">$${parseFloat(row["Profit"] || 0).toFixed(2)}</td>
            `;
            if (index === activeRowIndex) {
                tr.classList.add('selected');
                document.getElementById('activeRowIndicator').innerText = `Active WO: ${row["WO"]} | Item: ${row["Item Number"]}`;
            }
            tbody.appendChild(tr);
        });
    }

    function selectRow(index, trElement) {
        if (activeRowIndex >= 0 && activeRowIndex !== index) saveBuilderStateToRow(activeRowIndex);

        activeRowIndex = index;
        activeRowRef = masterData[index];

        document.querySelectorAll('#masterDataGrid tbody tr').forEach(tr => tr.classList.remove('selected'));
        if(trElement) trElement.classList.add('selected');
        
        const row = masterData[index];
        document.getElementById('activeRowIndicator').innerText = `Active WO: ${row["WO"]} | Item: ${row["Item Number"]}`;
        
        lastPriceMode = 'price'; 
        loadBuilderStateFromRow(row);
        calculateAll();
    }

    window.removeBuilderRow = (btn) => {
        btn.closest('tr').remove();
        window.calcTrigger();
    };

    function addBomRow(name = "", mcost = 0, mcap = 0, bqty = 0, comp = 100, note = "") {
        const tr = document.createElement('tr');
        tr.className = 'bom-row';
        tr.innerHTML = `
            <td><button class="btn-del" onclick="window.removeBuilderRow(this)">-</button></td>
            <td><input type="text" class="b-item" value="${name}" oninput="window.calcTrigger()"></td>
            <td><input type="number" class="b-mcost calc-trigger" value="${mcost}"></td>
            <td><input type="number" class="b-mcap calc-trigger" value="${mcap}"></td>
            <td class="calc-cell b-rate">0.00</td>
            <td><input type="number" class="b-bqty calc-trigger" value="${bqty}"></td>
            <td class="calc-cell b-total">0.00</td>
            <td><input type="number" class="b-comp calc-trigger" value="${comp}" max="100" min="0"></td>
            <td class="calc-cell b-wip">0.00</td>
            <td><input type="text" class="note-input b-note" value="${note}" oninput="window.calcTrigger()"></td>
        `;
        document.getElementById('bom-tbody').appendChild(tr);
        tr.querySelectorAll('.calc-trigger').forEach(el => el.addEventListener('input', window.calcTrigger));
    }

    function addLaborRow(name = "", mcost = 0, mcap = 0, bqty = 0, comp = 100, note = "") {
        const tr = document.createElement('tr');
        tr.className = 'labor-row';
        tr.innerHTML = `
            <td><button class="btn-del" onclick="window.removeBuilderRow(this)">-</button></td>
            <td><input type="text" class="l-item" value="${name}" oninput="window.calcTrigger()"></td>
            <td><input type="number" class="l-mcost calc-trigger" value="${mcost}"></td>
            <td><input type="number" class="l-mcap calc-trigger" value="${mcap}"></td>
            <td class="calc-cell l-rate">0.00</td>
            <td><input type="number" class="l-bqty calc-trigger" value="${bqty}"></td>
            <td class="calc-cell l-total">0.00</td>
            <td><input type="number" class="l-comp calc-trigger" value="${comp}" max="100" min="0"></td>
            <td class="calc-cell l-wip">0.00</td>
            <td><input type="text" class="note-input l-note" value="${note}" oninput="window.calcTrigger()"></td>
        `;
        document.getElementById('labor-tbody').appendChild(tr);
        tr.querySelectorAll('.calc-trigger').forEach(el => el.addEventListener('input', window.calcTrigger));
    }

    function addOhRow(name = "", mcost = 0, mcap = 0, bqty = 0, comp = 100, note = "") {
        const tr = document.createElement('tr');
        tr.className = 'oh-row';
        tr.innerHTML = `
            <td><button class="btn-del" onclick="window.removeBuilderRow(this)">-</button></td>
            <td><input type="text" class="o-item" value="${name}" oninput="window.calcTrigger()"></td>
            <td><input type="number" class="o-mcost calc-trigger" value="${mcost}"></td>
            <td><input type="number" class="o-mcap calc-trigger" value="${mcap}"></td>
            <td class="calc-cell o-rate">0.00</td>
            <td><input type="number" class="o-bqty calc-trigger" value="${bqty}"></td>
            <td class="calc-cell o-total">0.00</td>
            <td><input type="number" class="o-comp calc-trigger" value="${comp}" max="100" min="0"></td>
            <td class="calc-cell o-wip">0.00</td>
            <td><input type="text" class="note-input o-note" value="${note}" oninput="window.calcTrigger()"></td>
        `;
        document.getElementById('overhead-tbody').appendChild(tr);
        tr.querySelectorAll('.calc-trigger').forEach(el => el.addEventListener('input', window.calcTrigger));
    }

    function clearBuilder() {
        document.getElementById('bom-tbody').innerHTML = '';
        document.getElementById('labor-tbody').innerHTML = '';
        document.getElementById('overhead-tbody').innerHTML = '';
        document.getElementById('activeRowIndicator').innerText = "No Active Batch Selected";
        pYieldInput.value = "100";
        pPriceInput.value = "0.00";
        pMarginInput.value = "0.00";
    }

    function loadBuilderStateFromRow(row) {
        document.getElementById('bom-tbody').innerHTML = '';
        document.getElementById('labor-tbody').innerHTML = '';
        document.getElementById('overhead-tbody').innerHTML = '';
        
        const cb = row.costBuilder;
        if (cb.bom.length === 0) addBomRow(); else cb.bom.forEach(i => addBomRow(i.name, i.mcost, i.mcap, i.bqty, i.comp, i.note));
        if (cb.labor.length === 0) addLaborRow(); else cb.labor.forEach(i => addLaborRow(i.name, i.mcost, i.mcap, i.bqty, i.comp, i.note));
        if (cb.oh.length === 0) addOhRow(); else cb.oh.forEach(i => addOhRow(i.name, i.mcost, i.mcap, i.bqty, i.comp, i.note));
        
        pYieldInput.value = row["Quantity"] || 100;
        pPriceInput.value = row["Price / Unit"] || 0;
    }

    function saveBuilderStateToRow(index) {
        if (!masterData[index]) return;
        const cb = { bom: [], labor: [], oh: [], yield: 0, price: 0 };
        
        document.querySelectorAll('.bom-row').forEach(r => cb.bom.push({
            name: r.querySelector('.b-item').value, mcost: r.querySelector('.b-mcost').value, mcap: r.querySelector('.b-mcap').value, bqty: r.querySelector('.b-bqty').value, comp: r.querySelector('.b-comp').value, note: r.querySelector('.b-note').value
        }));
        document.querySelectorAll('.labor-row').forEach(r => cb.labor.push({
            name: r.querySelector('.l-item').value, mcost: r.querySelector('.l-mcost').value, mcap: r.querySelector('.l-mcap').value, bqty: r.querySelector('.l-bqty').value, comp: r.querySelector('.l-comp').value, note: r.querySelector('.l-note').value
        }));
        document.querySelectorAll('.oh-row').forEach(r => cb.oh.push({
            name: r.querySelector('.o-item').value, mcost: r.querySelector('.o-mcost').value, mcap: r.querySelector('.o-mcap').value, bqty: r.querySelector('.o-bqty').value, comp: r.querySelector('.o-comp').value, note: r.querySelector('.o-note').value
        }));
        
        masterData[index].costBuilder = cb;
    }

    function calculateAll() {
        if (activeRowIndex < 0) return;

        let totalBom = 0, totalBomWip = 0;
        let journalLines = [];

        document.querySelectorAll('.bom-row').forEach(r => {
            const mcost = parseFloat(r.querySelector('.b-mcost').value) || 0;
            const mcap = parseFloat(r.querySelector('.b-mcap').value) || 0;
            const bqty = parseFloat(r.querySelector('.b-bqty').value) || 0;
            const comp = (parseFloat(r.querySelector('.b-comp').value) || 0) / 100;
            const item = r.querySelector('.b-item').value;
            
            const rate = mcap > 0 ? mcost / mcap : 0;
            const tot = rate * bqty; 
            const wip = tot * comp;
            
            totalBom += tot; totalBomWip += wip;
            r.querySelector('.b-rate').innerText = rate.toFixed(4);
            r.querySelector('.b-total').innerText = tot.toFixed(2);
            r.querySelector('.b-wip').innerText = wip.toFixed(2);
            
            if (wip > 0 && item) journalLines.push({ account: `Inventory Asset: ${item}`, debit: 0, credit: wip, memo: `Applied Material: ${bqty} units @ $${rate.toFixed(4)}`});
        });
        document.getElementById('bom_cost_total').innerText = `$${totalBom.toFixed(2)}`;
        document.getElementById('bom_wip_total').innerText = `$${totalBomWip.toFixed(2)}`;

        let totalLab = 0, totalLabWip = 0;
        document.querySelectorAll('.labor-row').forEach(r => {
            const mcost = parseFloat(r.querySelector('.l-mcost').value) || 0;
            const mcap = parseFloat(r.querySelector('.l-mcap').value) || 0;
            const bqty = parseFloat(r.querySelector('.l-bqty').value) || 0;
            const comp = (parseFloat(r.querySelector('.l-comp').value) || 0) / 100;
            const item = r.querySelector('.l-item').value;
            
            const rate = mcap > 0 ? mcost / mcap : 0;
            const tot = rate * bqty; 
            const wip = tot * comp;
            
            totalLab += tot; totalLabWip += wip;
            r.querySelector('.l-rate').innerText = rate.toFixed(4);
            r.querySelector('.l-total').innerText = tot.toFixed(2);
            r.querySelector('.l-wip').innerText = wip.toFixed(2);
            
            if (wip > 0 && item) journalLines.push({ account: `Direct Labor Applied: ${item}`, debit: 0, credit: wip, memo: `Applied Labor: ${bqty} hrs @ $${rate.toFixed(4)}`});
        });
        document.getElementById('labor_cost_total').innerText = `$${totalLab.toFixed(2)}`;
        document.getElementById('labor_wip_total').innerText = `$${totalLabWip.toFixed(2)}`;

        let totalOh = 0, totalOhWip = 0;
        let machinesList = [];
        document.querySelectorAll('.oh-row').forEach(r => {
            const mcost = parseFloat(r.querySelector('.o-mcost').value) || 0;
            const mcap = parseFloat(r.querySelector('.o-mcap').value) || 0;
            const bqty = parseFloat(r.querySelector('.o-bqty').value) || 0;
            const comp = (parseFloat(r.querySelector('.o-comp').value) || 0) / 100;
            const item = r.querySelector('.o-item').value;
            if(item) machinesList.push(item);

            const rate = mcap > 0 ? mcost / mcap : 0;
            const tot = rate * bqty; 
            const wip = tot * comp;
            
            totalOh += tot; totalOhWip += wip;
            r.querySelector('.o-rate').innerText = rate.toFixed(4);
            r.querySelector('.o-total').innerText = tot.toFixed(2);
            r.querySelector('.o-wip').innerText = wip.toFixed(2);
            
            if (wip > 0 && item) journalLines.push({ account: `Factory Overhead Applied: ${item}`, debit: 0, credit: wip, memo: `Applied Overhead: ${bqty} drivers @ $${rate.toFixed(4)}`});
        });
        document.getElementById('oh_cost_total').innerText = `$${totalOh.toFixed(2)}`;
        document.getElementById('oh_wip_total').innerText = `$${totalOhWip.toFixed(2)}`;

        const batchTot = totalBom + totalLab + totalOh;
        const batchWipTot = totalBomWip + totalLabWip + totalOhWip;
        const pYield = parseFloat(pYieldInput.value) || 1;
        masterData[activeRowIndex]["Quantity"] = pYield; 

        document.getElementById('s_batch_cost').innerText = `$${batchTot.toFixed(2)}`;
        const unitCost = pYield > 0 ? (batchTot / pYield) : 0;
        document.getElementById('s_unit_cost').innerText = `$${unitCost.toFixed(4)}`;
        
        let pPrice = parseFloat(pPriceInput.value) || 0;
        let pMargin = parseFloat(pMarginInput.value) || 0;

        if (lastPriceMode === 'margin') {
            if (pMargin >= 100) {
                pPrice = 0; 
            } else {
                pPrice = unitCost / (1 - (pMargin / 100));
            }
            pPriceInput.value = pPrice.toFixed(2);
        } else {
            if (pPrice > 0) {
                pMargin = ((pPrice - unitCost) / pPrice) * 100;
            } else {
                pMargin = 0;
            }
            pMarginInput.value = pMargin.toFixed(2);
        }

        const sales = pPrice * pYield;
        const profit = sales - batchTot;

        masterData[activeRowIndex]["Price / Unit"] = pPrice.toFixed(2);
        masterData[activeRowIndex]["Std Cost / Unit"] = unitCost.toFixed(4);
        masterData[activeRowIndex]["Cost x QTY"] = batchTot.toFixed(2);
        masterData[activeRowIndex]["Total Batch Sales"] = sales.toFixed(2);
        masterData[activeRowIndex]["Profit"] = profit.toFixed(2);
        masterData[activeRowIndex]["# People"] = document.querySelectorAll('.labor-row').length;
        masterData[activeRowIndex]["Machine"] = machinesList.join(', ');

        document.getElementById('s_profit').innerText = `$${profit.toFixed(2)}`;

        saveBuilderStateToRow(activeRowIndex);
        renderDataGrid(); 
        
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
