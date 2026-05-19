// app.js
import DepreciationEngine from './depreciationEngine.js';
import StandardCostBuilder from './costBuilder.js';
import ComplianceExportProtocol from './complianceExport.js';

document.addEventListener('DOMContentLoaded', () => {
    let masterData = null;
    let depreciationEngine = null;
    let costBuilder = null;

    const ingestionInput = document.getElementById('dataIngestion');
    
    // Phase 1: Data Ingestion & State Initialization
    ingestionInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                masterData = JSON.parse(evt.target.result);
                document.getElementById('ingestionStatus').innerText = `Data Loaded: ${masterData.enterprise_metadata.entity_name} (${masterData.enterprise_metadata.reporting_period})`;
                document.getElementById('ingestionStatus').style.color = "var(--success-green)";
                document.getElementById('mainWorkspace').style.display = "grid";
                
                // Initialize execution engines
                depreciationEngine = new DepreciationEngine(masterData);
                costBuilder = new StandardCostBuilder(depreciationEngine, masterData);
                
                populateMachineDropdown(masterData.machine_capacities);
                
                // Display the unrecorded machinery base for user awareness
                const assetBase = masterData.fixed_assets.machinery_equipment.capitalized_value;
                document.getElementById('dispMachineryBase').innerText = assetBase.toLocaleString(undefined, {minimumFractionDigits: 2});
            } catch (err) {
                alert("Fatal Error: Invalid JSON structure.");
            }
        };
        reader.readAsText(file);
    });

    /**
     * Dynamically populates the machine selection dropdown based on ingested capacities.
     */
    function populateMachineDropdown(machines) {
        const select = document.getElementById('machineSelect');
        select.innerHTML = ''; // Clear existing
        machines.forEach(mac => {
            const option = document.createElement('option');
            option.value = mac.machine_id;
            option.text = mac.designation;
            select.appendChild(option);
        });
    }

    // Phase 2: Compute Overhead
    document.getElementById('btnCalculateOverhead').addEventListener('click', () => {
        const rates = depreciationEngine.allocateHourlyBurdenRates();
        const tbody = document.getElementById('depreciationTableBody');
        tbody.innerHTML = ''; // Clear existing rows
        
        rates.forEach((rate, machineId) => {
            const mac = masterData.machine_capacities.find(m => m.machine_id === machineId);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${mac.designation}</td>
                <td>${mac.practicalAnnualHours.toLocaleString()}</td>
                <td class="numeric">$${rate.toFixed(4)}</td>
            `;
            tbody.appendChild(tr);
        });
    });

    // Phase 3: Assembly & BOM Construction
    document.getElementById('btnAddMaterial').addEventListener('click', () => {
        const sku = prompt("Enter Material SKU (e.g., FB475-PH614):");
        if(!sku) return;
        const qty = parseFloat(prompt("Enter Quantity Required (KG):"));
        
        const extCost = costBuilder.addBomLineItem(sku, qty);
        if (extCost > 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${sku}</td>
                <td class="numeric">${qty.toFixed(2)}</td>
                <td class="numeric">$${costBuilder.getValidatedMaterialCost(sku).toFixed(2)}</td>
                <td class="numeric">$${extCost.toFixed(2)}</td>
            `;
            document.getElementById('bomBody').appendChild(tr);
            updateCostSummary();
        }
    });

    /**
     * Re-calculates and renders the final standard cost matrix.
     */
    function updateCostSummary() {
        const machineId = document.getElementById('machineSelect').value;
        const runTime = parseFloat(document.getElementById('runTimeHrs').value) || 0;
        const batchQty = parseFloat(document.getElementById('batchQty').value) || 1;

        const totals = costBuilder.calculateStandardBatchCost(machineId, runTime);
        const unitCost = totals.totalBatchCost / batchQty;

        document.getElementById('totMaterial').innerText = `$${totals.directMaterials.toFixed(2)}`;
        document.getElementById('totOverhead').innerText = `$${totals.appliedOverhead.toFixed(2)}`;
        document.getElementById('totBatchCost').innerText = `$${totals.totalBatchCost.toFixed(2)}`;
        document.getElementById('totUnitCost').innerText = `$${unitCost.toFixed(4)}`;
    }

    // Bind real-time recalculation to input changes
    document.getElementById('runTimeHrs').addEventListener('input', updateCostSummary);
    document.getElementById('batchQty').addEventListener('input', updateCostSummary);
    document.getElementById('machineSelect').addEventListener('change', updateCostSummary);

    // Phase 4: Compliance Adjustments Export
    document.getElementById('btnGenerateJournals').addEventListener('click', () => {
        const complianceProtocol = new ComplianceExportProtocol(masterData);
        const jsonOutput = complianceProtocol.exportToJSON();
        downloadJSON(jsonOutput, "GAAP_Compliance_Entries.json");
    });
    
    // Internal Control Purge Trigger
    document.getElementById('btnPurgeAme007').addEventListener('click', () => {
        alert("System freeze initiated on Vendor AME-007. Synthetic liabilities queued for reversal.");
    });

    /**
     * Utility function to trigger browser download of generated JSON payloads.
     */
    function downloadJSON(dataStr, filename) {
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }
});
