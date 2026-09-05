import { runMlp } from "../src/lib/ml/mlp";
const perfect = {age:9,accuracy_overall:1,reading_accuracy:1,attention_accuracy:1,math_accuracy:1,memory_score:1,response_time_avg:3,response_time_var:1,spelling_errors:0,mirror_letter_errors:0,retry_frequency:0,task_completion:1,engagement_min:1};
console.log("perfect fast (engagement 1min):", runMlp(perfect as any));
console.log("perfect engagement 18:", runMlp({...perfect, engagement_min:18} as any));
console.log("perfect rt 5.5 eng18:", runMlp({...perfect, response_time_avg:5.5, response_time_var:1.9, engagement_min:18} as any));
const zero = {...perfect, accuracy_overall:0,reading_accuracy:0,attention_accuracy:0,math_accuracy:0,memory_score:0,spelling_errors:2,mirror_letter_errors:1,retry_frequency:1,task_completion:0.8,engagement_min:18,response_time_avg:12,response_time_var:9};
console.log("all wrong:", runMlp(zero as any));
