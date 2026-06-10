import os
import sys
import json
import pandas as pd
from datasets import Dataset
from dotenv import load_dotenv


from unittest.mock import MagicMock
sys.modules['langchain_community.chat_models.vertexai'] = MagicMock()

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from ragas import evaluate
from ragas.metrics import (
    context_precision,
    context_recall,
    faithfulness,
    answer_relevancy,
)


load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env.local'))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

def load_data(file_path):
    with open(file_path, 'r') as f:
        data = json.load(f)
    
    # Ragas requires a specific HuggingFace Dataset format
    dataset_dict = {
        "question": [],
        "answer": [],
        "contexts": [],
        "ground_truth": []
    }
    
    for item in data:
        dataset_dict["question"].append(item.get("question", ""))
        dataset_dict["answer"].append(item.get("answer", ""))
        dataset_dict["contexts"].append(item.get("contexts", []))
        dataset_dict["ground_truth"].append(item.get("ground_truth", ""))
        
    return Dataset.from_dict(dataset_dict)

def main():
    print("Initializing Ragas Evaluation using Groq LLM...")
    
    groq_api_key = os.environ.get("GROQ_API_KEY")
    if not groq_api_key:
        print("Error: GROQ_API_KEY not found in environment variables.")
        return

    # Use the same LLM configured in the Next.js app for evaluation
    eval_llm = ChatGroq(
        temperature=0, 
        groq_api_key=groq_api_key, 
        model_name="llama-3.3-70b-versatile"
    )

    # Use local HuggingFace embeddings for Ragas evaluation metrics (e.g. answer_relevancy)
    print("Initializing HuggingFace embeddings...")
    eval_embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    dataset_path = os.path.join(os.path.dirname(__file__), 'eval_dataset.json')
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        return
        
    print(f"Loading dataset from {dataset_path}...")
    eval_dataset = load_data(dataset_path)
    print(f"Loaded {len(eval_dataset)} evaluation items.")
    
    print("Starting evaluation (this may take a minute)...")
    
    # List of metrics to evaluate
    metrics = [
        context_precision,
        context_recall,
        faithfulness,
        answer_relevancy
    ]

    try:
        result = evaluate(
            eval_dataset,
            metrics=metrics,
            llm=eval_llm,
            embeddings=eval_embeddings,
        )
        
        print("\n=== Evaluation Results ===")
        print(result)
        
        # Save to CSV
        output_csv = os.path.join(os.path.dirname(__file__), 'evaluation_results.csv')
        df = result.to_pandas()
        df.to_csv(output_csv, index=False)
        print(f"\nDetailed results saved to {output_csv}")
        
    except Exception as e:
        print(f"An error occurred during evaluation: {e}")

if __name__ == "__main__":
    main()
