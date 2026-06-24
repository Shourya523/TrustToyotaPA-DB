import { getConnectionInsight } from '../src/actions/playground.ts';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    function nameToSsn(name) {
      let hash = 0;
      for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash % 9000000) + 1000000;
    }
    const mbSsn = nameToSsn("Michael Brown");
    console.log("Michael Brown ssn:", mbSsn);

    // Let's check with the correct ssn
    const res2 = await getConnectionInsight({
      empSsn: mbSsn,
      carLabel: "Kia Cerato",
      branchId: null,
      monthNum: null,
      year: null
    });
    console.log("Insight with correct SSN:", res2.summaryText, "Cars:", res2.carsSold, "Revenue:", res2.revenue);

    // Let's check with branchId of Thomasmouth
    // Thomasmouth branchId is 3649
    const res3 = await getConnectionInsight({
      empSsn: mbSsn,
      carLabel: "Kia Cerato",
      branchId: 3649,
      monthNum: null,
      year: null
    });
    console.log("Insight with branch 3649 (Thomasmouth):", res3.summaryText, "Cars:", res3.carsSold, "Revenue:", res3.revenue);

  } catch (err) {
    console.error(err);
  }
}

run();
