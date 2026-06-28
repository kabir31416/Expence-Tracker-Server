import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from 'dotenv'
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
app.get('/', (req, res) => {
    res.send('Wellcome to Expenceserver');
});

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let db = null;

async function getDB() {
    if (!db) {
        await client.connect();
        db = client.db("Expense");
        console.log("MongoDB Connected");
    }
    return db;
}

async function startServer() {
    try {
        await getDB();
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
    }
}

startServer();

const Spend = () => db.collection("spend");

app.get("/api/expence", async (req, res) => {
    const {
        category,
        search,
    } = req.query;

    let query = {};

    if (category) {
        query.category = category;
    }

    if (search) {
        query.$or = [
            {
                title: {
                    $regex: search,
                    $options: "i",
                },
            },
        ];
    }

    let cursor = Spend().find(query);

    const total = await Spend().countDocuments(query);

        const artworks = await cursor
            .skip((page - 1) * Number(limit))
            .limit(Number(limit))
            .toArray();

        res.json({
            artworks,
            total,
            currentPage: Number(page),
            totalPages: Math.ceil(total / limit),
        });
})

app.post("/api/expence", async (req, res) => {
    const spend = {
        ...req.body,
        amount: Number(req.body.amount),
        createdAt: new Date()
    }

    const result = await Spend().insertOne(spend);
})




