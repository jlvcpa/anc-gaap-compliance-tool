// depreciationEngine.js
export default class DepreciationEngine {
    constructor(masterData) {
        this.machineryBase = masterData.fixed_assets.machinery_equipment.capitalized_value;
        this.usefulLife = masterData.fixed_assets.machinery_equipment.useful_life_years;
        this.machines = masterData.machine_capacities;
        
        // Ensure data integrity; audit found $0 depreciation recognized.
        // $1,730,758.12 / 7 years = $247,251.16 annual baseline depreciation.
        this.annualDepreciationExpense = this.machineryBase / this.usefulLife;
        this.hourlyRates = new Map();
    }

    /**
     * Computes the total effective operating hours for the facility based on 
     * uptime utilization factors and a standard 260-day operational year.
     * Prevents over-allocation of overhead to idle time.
     */
    calculateTotalPracticalHours() {
        const operatingDaysPerYear = 260; // Standard manufacturing calendar
        let totalSystemHours = 0;

        this.machines.forEach(machine => {
            // Convert daily capacities to operational hours assuming optimal efficiency
            let theoreticalDailyHours = 24; 
            
            // Adjust theoretical capacity by the machine's specific uptime utilization factor
            // For example, Encapsulation 3500 running at 85% uptime 
            let practicalDailyHours = theoreticalDailyHours * (machine.uptime_utilization_factor || 0.80);
            let practicalAnnualHours = practicalDailyHours * operatingDaysPerYear;
            
            machine.practicalAnnualHours = practicalAnnualHours;
            totalSystemHours += practicalAnnualHours;
        });

        return totalSystemHours;
    }

    /**
     * Executes the ASC 360 allocation, establishing fully burdened machine rates.
     */
    allocateHourlyBurdenRates() {
        const totalSystemHours = this.calculateTotalPracticalHours();
        
        // Determine the base depreciation cost per machine hour across the facility
        const baseDepreciationPerSystemHour = this.annualDepreciationExpense / totalSystemHours;

        this.machines.forEach(machine => {
            // Additional fixed factory overhead variables (rent, indirect labor) 
            // should be integrated here. For the scope of resolving the specific 
            // ASC 360 omission, we isolate the machinery depreciation vector.
            
            const hourlyBurdenRate = baseDepreciationPerSystemHour; 
            this.hourlyRates.set(machine.machine_id, hourlyBurdenRate);
        });

        return this.hourlyRates;
    }

    /**
     * Returns the exact dollar amount of overhead to apply to a specific production run.
     * @param {string} machineId - The internal identifier for the equipment.
     * @param {number} runTimeHours - The continuous operational hours for the batch.
     */
    getRunOverheadCost(machineId, runTimeHours) {
        if (!this.hourlyRates.has(machineId)) {
            console.warn(`Machine ID ${machineId} unrecognized. Applying default penalty rate.`);
            // Arbitrary penalty rate to flag unregistered equipment and force investigation
            return runTimeHours * 150.00; 
        }
        return this.hourlyRates.get(machineId) * runTimeHours;
    }
}
