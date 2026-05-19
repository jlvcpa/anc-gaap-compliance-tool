// costBuilder.js
export default class StandardCostBuilder {
    constructor(depreciationEngine, masterData) {
        this.depreciationEngine = depreciationEngine;
        this.inventoryLedger = masterData.inventory_ledger;
        this.bomItems =;
    }

    /**
     * Safely retrieves the unit cost of an ingredient, executing an override 
     * protocol if the system book value has collapsed to $0.00 improperly.
     * @param {string} sku - The inventory item number (e.g., FB475-PH614).
     */
    getValidatedMaterialCost(sku) {
        const material = this.inventoryLedger.find(item => item.sku === sku);
        if (!material) {
            console.error(`CRITICAL: SKU ${sku} does not exist in master ledger.`);
            return 0.00;
        }

        // Rectification Protocol for Zero-Book-Value Anomaly 
        // Intercepts items like Y475X-81 LIME and FB603-63 BU RECOV 2.0 CHOC
        if (material.costing_error && material.book_value === 0.00) {
            console.warn(` SKU ${sku} triggered zero-value glitch. Substituting with verified system average cost of $${material.system_average_cost}.`);
            return material.system_average_cost;
        }

        // Defaults to book value if valid, otherwise falls back to system average
        return material.book_value > 0? material.book_value : material.system_average_cost;
    }

    /**
     * Appends a raw material component to the Bill of Materials.
     */
    addBomLineItem(sku, quantityRequired) {
        try {
            const unitCost = this.getValidatedMaterialCost(sku);
            const extendedCost = unitCost * quantityRequired;
            
            this.bomItems.push({
                sku: sku,
                quantity: quantityRequired,
                unitCost: unitCost,
                extendedCost: extendedCost
            });
            
            return extendedCost;
        } catch (error) {
            console.error(error.message);
            return 0.00;
        }
    }

    /**
     * Aggregates the total cost of all direct materials injected into the batch.
     */
    calculateTotalMaterialCost() {
        return this.bomItems.reduce((sum, item) => sum + item.extendedCost, 0);
    }

    /**
     * Assembles the fully burdened cost of the production batch, bridging 
     * direct materials with ASC 360 compliant machine overhead.
     * @param {string} machineId - The equipment identifier utilized.
     * @param {number} runTimeHours - Total processing duration.
     */
    calculateStandardBatchCost(machineId, runTimeHours) {
        const totalMaterials = this.calculateTotalMaterialCost();
        const appliedOverhead = this.depreciationEngine.getRunOverheadCost(machineId, runTimeHours);
        
        return {
            directMaterials: totalMaterials,
            appliedOverhead: appliedOverhead,
            totalBatchCost: totalMaterials + appliedOverhead
        };
    }
}