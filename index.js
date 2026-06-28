import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from 'dotenv';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
    res.send('Welcome to Expense Server');
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
    try {
        const { category, search } = req.query;
        const query = {};

        if (category && category !== "All") {
            query.category = category;
        }

        if (search) {
            query.title = {
                $regex: search,
                $options: "i",
            };
        }

        const totalExpense = await Spend().aggregate([
            {
                $match: query,
            },
            {
                $group: {
                    _id: null,
                    total: {
                        $sum: "$amount",
                    },
                },
            },
        ]).toArray();

        const spends = await Spend()
            .find(query)
            .sort({ createdAt: -1 })
            .toArray();

        const total = await Spend().countDocuments(query);

        res.status(200).json({
            spends,
            total,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.post("/api/expence", async (req, res) => {
    try {
        const spend = {
            title: req.body.title,
            category: req.body.category,
            amount: Number(req.body.amount),
            date: req.body.date,
            createdAt: new Date(),
        };

        const result = await Spend().insertOne(spend);

        res.status(201).json({
            success: true,
            insertedId: result.insertedId,
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Failed to create expense" });
    }
});

app.put('/api/expence/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, amount, category, date } = req.body;

        if (!title || !amount || !category || !date) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
            $set: {
                title,
                amount: Number(amount),
                category,
                date
            }
        };

        const result = await Spend().updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: "Expense record not found" });
        }
        const updatedExpense = { _id: id, title, amount: Number(amount), category, date };

        res.status(200).json({
            success: true,
            message: "Expense updated successfully",
            updatedExpense
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error running update" });
    }
});

app.delete('/api/expence/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await Spend().deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: "Expense record not found" });
        }
        res.status(200).json({
            success: true,
            message: "Expense deleted successfully"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error running delete" });
    }
});

app.get("/api/expense/dashboard", async (req, res) => {
  try {
    const budget = 35000;

    const now = new Date();


    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);


    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const tomorrow = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );


    const totalExpenseResult = await Spend()
      .aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ])
      .toArray();

    const totalExpense = totalExpenseResult[0]?.total || 0;


    const totalTransactions = await Spend().countDocuments();

    const monthlyExpenseResult = await Spend()
      .aggregate([
        {
          $match: {
            createdAt: {
              $gte: firstDayOfMonth,
              $lt: lastDayOfMonth,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ])
      .toArray();

    const monthlyExpense = monthlyExpenseResult[0]?.total || 0;


    const todayExpenseResult = await Spend()
      .aggregate([
        {
          $match: {
            createdAt: {
              $gte: todayStart,
              $lt: tomorrow,
            },
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ])
      .toArray();

    const todayExpense = todayExpenseResult[0]?.total || 0;


    const remainingBudget = budget - monthlyExpense;


    const lastDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();

    const remainingDays =
      lastDate - now.getDate() + 1;

    const dailySafeSpend =
      remainingDays > 0
        ? Math.floor(remainingBudget / remainingDays)
        : 0;


    res.status(200).json({
      totalExpense,
      totalTransactions,
      monthlyExpense,
      todayExpense,
      remainingBudget,
      dailySafeSpend,
      budget,
    });

  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Failed to load dashboard",
    });
  }
});