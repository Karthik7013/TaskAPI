const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv')
dotenv.config();
const salt_rounds = 10;

const MONGO = process.env.MONGO_URI;
const PORT = process.env.PORT || 8000;
const SECRET_KEY = process.env.SECRET_KEY

let blackListTokens = []
mongoose.connect(MONGO).then(() => {
    console.log("db connected")
    app.listen(PORT, () => {
        console.log("server running on port 8000")
    })
}).catch(() => {
    console.log("failed to connect")
})

const app = express();
app.use(express.json());
app.use(cors())

const taskSchema = mongoose.Schema({
    author: { type: String, required: true },
    author_id: { type: String, required: true },
    title: { type: String, required: true },
    desc: { type: String, required: true },
    image: { type: String },
    completed: { type: Boolean, default: false },
    createdOn: { type: Date, default: Date.now() },
    updatedOn: { type: Date, default: Date.now() }
})
const userSchema = mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isAdmin: { type: Boolean, default: false },
    profile: { type: String, default: "" }
})

const task = mongoose.model('task', taskSchema);
const user = mongoose.model('user', userSchema);

// add user task
app.post('/task/add', isAuthenticated, async (req, res) => {
    try {
        let { name, _id } = req.user;
        console.log(name, _id)
        let { title, desc } = req.body
        console.log(title, desc)
        let newTask = await task.create({ author: name, author_id: _id, title, desc });
        res.status(201).json(newTask)
    } catch (error) {
        res.status(500).json({ message: "internal error" })
    }

})

// delete a user task
app.delete('/task/:id', isAuthenticated, async (req, res) => {
    try {
        let { _id } = req.user
        let { id } = req.params;
        let result = await task.findOne({ _id: id })
        console.log(result, 'taks')
        if (result) {
            if (result.author_id === _id) {
                await task.findByIdAndDelete(id)
                res.status(200).json({ message: "task deleted successfully !" })
            } else {
                res.status(404).json({ message: "not allowed to delete" })
            }
        } else {
            res.status(200).json({ message: 'no task found' })
        }
    } catch (error) {
        res.status(500).json({ message: 'internal error' })
    }
})

// update a user task
app.put('/task/:id', isAuthenticated, async (req, res) => {
    try {
        let { _id } = req.user;
        let { id } = req.params;
        let updateData = req.body;
        let result = await task.findOne({ _id: id })
        if (result) {
            if (result.author_id === _id) {
                await task.findByIdAndUpdate(id, { ...updateData, updatedOn: Date.now() });
                let updatedTask = await task.findById(id);
                res.status(200).json(updatedTask);
            } else {
                res.status(400).json({ message: 'not allowed to edit other posts' })
            }
        } else {
            res.status(404).json({ message: 'no task found !' })
        }
    } catch (error) {
        res.status(500).json({ message: 'internal error' })
    }
})

// getUser task
app.get('/task/all', isAuthenticated, async (req, res) => {
    try {
        let { _id } = req.user;
        let alltasks = await task.find({ author_id: _id });
        res.status(200).json({ tasks: alltasks });
    } catch (error) {
        res.status(500).json({ message: 'internal error' })
    }
})

// signin, signout and signup
app.post('/user/signup', async (req, res) => {
    try {
        let { name, email, password } = req.body;
        let userExists = await user.findOne({ 'email': email })
        if (userExists) { res.status(400).json({ message: "email already taken" }) }
        else {
            await user.create({
                name,
                email,
                password
            })
            res.status(201).json({ message: "user registered successfully !" })
        }
    } catch (error) {
        res.status(500).json({ message: "Internal Error" })
    }
})

app.post('/user/signin', async (req, res) => {
    try {
        let { email, password } = req.body;
        let userExists = await user.findOne({ 'email': email })
        console.log(userExists)
        if (userExists) {
            if (userExists.password === password) {
                const token = jwt.sign({ user: userExists }, SECRET_KEY, { expiresIn: '1h' })
                res.status(200).json({ token, expIn: '1h' })
            } else {
                res.status(400).json({ message: 'wrong password' })
            }
        } else {
            res.status(404).json({ message: 'user not found' })
        }
    } catch (error) {
        res.status(500).json({ message: "Internal Error !" })
    }
})

app.post('/user/logout', (req, res) => {

    try {
        let { token } = req.headers;
        blackListTokens.push(token);
        res.status(200).json({ message: "log out success" })
    } catch (error) {
        res.status(500).json({ message: "internal error" })
    }

})

// auth checker
function isAuthenticated(req, res, next) {
    const { token } = req.headers
    if (token && !blackListTokens.includes(token)) {
        jwt.verify(token, SECRET_KEY, (err, decoded) => {
            if (err) {
                res.status(400).json({ message: "invalid token" })
            } else {
                req.user = decoded.user
                next()
            }
        })
    } else {
        res.status(404).json({ message: 'please provide token' })
    }
}

app.get('/user', isAuthenticated, async (req, res) => {
    res.status(200).json(req.user)
})