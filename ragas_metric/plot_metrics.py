import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import os

def main():
    csv_path = os.path.join(os.path.dirname(__file__), 'evaluation_results.csv')
    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        return

    # Read the CSV
    df = pd.read_csv(csv_path)

    # Ragas metrics columns
    metric_cols = ['context_precision', 'context_recall', 'faithfulness', 'answer_relevancy']
    
    # Check which metrics actually exist in the CSV
    available_metrics = [col for col in metric_cols if col in df.columns]
    
    # Calculate means, ignoring NaN values
    means = df[available_metrics].mean().fillna(0)

    # Set up the plot style
    sns.set_theme(style="whitegrid")
    plt.figure(figsize=(10, 6))

    # Create a bar plot
    ax = sns.barplot(x=means.index, y=means.values, palette="viridis")

    # Customize the plot
    plt.title('RAG Evaluation Metrics (Mean Scores)', fontsize=16, pad=20)
    plt.ylabel('Score (0 to 1)', fontsize=12)
    plt.xlabel('Metric', fontsize=12)
    plt.ylim(0, 1.1)  # Scores are between 0 and 1
    
    # Add value labels on top of each bar
    for i, v in enumerate(means.values):
        ax.text(i, v + 0.02, f'{v:.2f}', ha='center', va='bottom', fontweight='bold')

    # Save the plot
    output_path = os.path.join(os.path.dirname(__file__), 'ragas_report.png')
    plt.tight_layout()
    plt.savefig(output_path, dpi=300)
    print(f"Graph successfully saved to: {output_path}")

if __name__ == "__main__":
    main()
