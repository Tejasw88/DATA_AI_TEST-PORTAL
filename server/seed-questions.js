const fs = require('fs');
const csv = require('csv-parser');
const pool = require('./db');
require('dotenv').config();

async function seedData() {
    try {
        console.log('--- Seeding MCQ Questions ---');
        const mcqData = [];
        fs.createReadStream('MCQ_Questions.csv')
            .pipe(csv())
            .on('data', (row) => {
                mcqData.push(row);
            })
            .on('end', async () => {
                for (const row of mcqData) {
                    const options = {
                        A: row['Option A'],
                        B: row['Option B'],
                        C: row['Option C'],
                        D: row['Option D']
                    };
                    await pool.query(
                        'INSERT INTO questions (type, domain, difficulty, title, content, options, correct_answer, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        ['MCQ', row.Domain, row.Level, row.Question, row.Question, JSON.stringify(options), row.Answer, 1]
                    );
                }
                console.log(`Seeded ${mcqData.length} MCQ questions.`);
                
                await seedCoding();
            });
    } catch (error) {
        console.error('Error seeding MCQ:', error);
    }
}

async function seedCoding() {
    try {
        console.log('--- Seeding Coding Questions & Test Cases ---');
        
        const testCasesMap = {};
        await new Promise((resolve) => {
            fs.createReadStream('Coding_TestCases.csv')
                .pipe(csv())
                .on('data', (row) => {
                    const qId = row['Question S.No'];
                    if (!testCasesMap[qId]) testCasesMap[qId] = [];
                    testCasesMap[qId].push({
                        id: row['TestCase ID'],
                        input: row.Input,
                        output: row.Output
                    });
                })
                .on('end', resolve);
        });

        const codingData = [];
        fs.createReadStream('Coding_Questions.csv')
            .pipe(csv())
            .on('data', (row) => {
                codingData.push(row);
            })
            .on('end', async () => {
                for (const row of codingData) {
                    const qSNo = row['S.No'];
                    const testCases = testCasesMap[qSNo] || [];
                    
                    const starterCode = {
                        javascript: "// Write your code here\nfunction solution(input) {\n  return input;\n}",
                        python: "# Write your code here\ndef solution(input):\n    return input",
                        java: "public class Solution {\n    public static void main(String[] args) {\n        // Your code here\n    }\n}"
                    };

                    await pool.query(
                        'INSERT INTO questions (type, domain, difficulty, title, content, test_cases, starter_code, marks) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        ['Coding', row.Domain, row.Level, row.Question, row.Description, JSON.stringify(testCases), JSON.stringify(starterCode), 10]
                    );
                }
                console.log(`Seeded ${codingData.length} Coding questions.`);
                console.log('--- Data Seeding Complete ---');
                process.exit(0);
            });
    } catch (error) {
        console.error('Error seeding Coding:', error);
        process.exit(1);
    }
}

seedData();
