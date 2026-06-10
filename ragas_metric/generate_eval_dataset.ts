import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { chatWithSchema } from '../src/actions/chat';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const TEST_DATA_PATH = path.join(__dirname, 'test_data.json');
const OUTPUT_DATA_PATH = path.join(__dirname, 'eval_dataset.json');

async function run() {
    console.log("Starting Ragas Evaluation Dataset Generation...");
    
    // Load test questions
    let testData;
    try {
        const fileContent = fs.readFileSync(TEST_DATA_PATH, 'utf-8');
        testData = JSON.parse(fileContent);
    } catch (e) {
        console.error("Could not read test_data.json. Did you create it?", e);
        return;
    }

    const outputDataset = [];
    // Assuming a test connection_id for evaluation purposes.
    const CONNECTION_ID = "test"; 

    for (let i = 0; i < testData.length; i++) {
        const item = testData[i];
        console.log(`\nProcessing Question ${i + 1}/${testData.length}: "${item.question}"`);
        
        try {
            // Call the chat action with returnContext=true
            const result = await chatWithSchema(item.question, CONNECTION_ID, [], true);
            
            if (result.success) {
                outputDataset.push({
                    question: item.question,
                    answer: result.answer,
                    contexts: result.context || [],
                    ground_truth: item.ground_truth
                });
                console.log(`Success. Contexts retrieved: ${result.context?.length || 0}`);
            } else {
                console.error(`Failed to process question: ${result.error}`);
            }
        } catch (err) {
            console.error(`Error executing chatWithSchema for question: "${item.question}"`, err);
        }
    }

    // Write the resulting dataset
    fs.writeFileSync(OUTPUT_DATA_PATH, JSON.stringify(outputDataset, null, 2));
    console.log(`\nGeneration complete. Dataset saved to: ${OUTPUT_DATA_PATH}`);
}

run();
