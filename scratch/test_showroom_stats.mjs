import { getNationalShowroomStats } from '../src/actions/showroom.ts';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.time("getNationalShowroomStats");
  try {
    const res = await getNationalShowroomStats();
    console.timeEnd("getNationalShowroomStats");
    console.log("Success! Total branches:", res.totalBranches);
    console.log("Total revenue:", res.totalRevenue);
    console.log("Top salespeople:", res.topSalespeople);
    console.log("Top cars:", res.topCars);
    console.log("Top branches:", res.topBranches);
  } catch (err) {
    console.timeEnd("getNationalShowroomStats");
    console.error("Error:", err);
  }
}

run();
