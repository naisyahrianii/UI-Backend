const express  = require('express');
const port = require('./config');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const User = require('./models/user');
const Task = require('./models/task')
require('./config/mongose');


const app = express();
app.use(cors())
app.use(express.json());

app.get('/', (req, res) => {
    res.send(`<h1>Express Mongoose berjalan di Heroku</h1>`)
})

// Register new user
app.post('/users', async (req, res) => {
    const user = new User(req.body)

    try{
        await user.save()
        res.status(200).send(user)
    } catch (e){
        res.status(400).send(e.message)
    }
});

// Login users in login
// app.get("/users", async (req, res) => {
//     const {email, password} = req.query

//     try {
//       const users = await User.find({email, password}); // mongoose documentation: Queries > Model.find(), result: array of users
//       res.status(200).send(users); // send array of users by email and password to front end
//     } catch (e) {
//       res.status(500).send(e); //status: internal server error
//     }
//   });

app.post('/users/login', async (req, res) => {
    const {email, password} = req.body

     try {
        const user = await User.findByCredentials(email, password) // Function buatan sendiri
        res.status(200).send(user)
        
    } catch (e) {
        res.status(404).send(e)
    }
})

// Tasks (utk personalise To-Do List sesuai user yang login)
app.post('/tasks/:userid', async (req, res) => {
    try {
        const user = await User.findById(req.params.userid) // search user by id
        if (!user) { // jika user tidak ditemukan
            throw new Error("Unable to create task")
        }
        const task = new Task({ ...req.body, owner: user._id }) // membuat task dengan menyisipkan user id di kolom owner
        user.tasks = user.tasks.concat(task._id) // tambahkan id dari task yang dibuat ke dalam field 'tasks' user yg membuat task
        await task.save() // save task
        await user.save() // save user
        res.status(201).send(task)
    } catch (e) {
        res.status(404).send(e)
    }
}) 

// Delete user and all tasks
app.delete('/users/:userid', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.userid)
        if(!user){
            throw new Error("unable to delete")
            
        }
        await Task.deleteMany({owner: user._id}).exec()
        res.send("delete successful")
    } catch (e) {
        res.send(e)
    }
})

// Grouping tasks sesuai dengan user pemilik tasks
app.get('/tasks/:userid', async (req, res) => {
    try {
        // find mengirim dalam bentuk array
       const user = await User.find({_id: req.params.userid})
                    .populate({
                        path:'tasks',
                        options: { sort: {completed: false},
                        limit: 5}
                    }).exec()
        res.send(user[0].tasks)
    } catch (e) {

     }
})

// Delete tasks
app.delete("/tasks", async (req, res) => {
    try {
      const task = await Task.findOneAndDelete({ _id: req.body.taskid });
      const user = await User.findOne({ _id: req.body.owner });
  
       if (!task) {
        return res.status(404).send("Delete failed");
      }
    
      user.tasks = await user.tasks.filter(val => val != req.body.taskid);
      user.save();
      console.log(user.tasks);
  
      res.status(200).send(task);
    } catch (e) {
      res.status(500).send(e);
    }
});

// Edit tasks
app.patch('/tasks/:taskid/:userid', async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['description', 'completed']
    const isValidOperation = updates.every(update => allowedUpdates.includes(update))

     if(!isValidOperation) {
        return res.status(400).send({err: "Invalid request!"})
    }

     try {
        const task = await Task.findOne({_id: req.params.taskid, owner: req.params.userid})

         if(!task){
            return res.status(404).send("Update Request")
        }

         updates.forEach(update => task[update] = req.body[update])
        await task.save()

         res.send("update berhasil")


     } catch (e) {

     }
})

// Upload avatar
const upload = multer({
    limits:{
        fileSize: 1000000 // Byte max size
    },
    fileFilter(req, file, cb){ 
        if(!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Please upload image file(jpg, jpeg, png'))
        }
        // file diterima
        cb(undefined, true) 
        // cb (callback), function bawaan dari multer
        // kalo mau throw error bisa juga 'cb(undefined, false)' tapi ga ada pesan errornya
    }
})

app.post('/users/:userid/avatar', upload.single('avatar'), async(req, res) => {
    try {
        const buffer = await sharp(req.file.buffer).resize({ width: 250 }).png().toBuffer();
        const user = await User.findById(req.params.userid); 

        if(!User){
            throw Error ('Unable to upload')
        }

        user.avatar = buffer
        await user.save()
        res.send('Upload success')
    } catch (e) {
        res.send(e)
    }
})

// Show avatar
app.get('/users/:userid/avatar/:ava', async(req, res) => {
    try {
        const user = await User.findById(req.params.userid);

        if(!user || !user.avatar){
            throw new Error('Not found')
        }

        res.set('Content-Type', 'image/png')
        res.send(user.avatar)

    } catch (e) {
        res.send(e)
    }
})

// Delete avatar
app.delete('/users/:userid/avatar/:ava', async(req, res) => {
    try {
        const user = await User.findByIdAndUpdate(req.params.userid, {$set: {avatar: null}});

        if(!user || !user.avatar){
            throw new Error('Not found')
        }
        
        res.send('avatar has been removed')

    } catch (e) {
        res.send(e)
    }
})

// Edit profile
app.patch('/users/:userid', async (req, res) => { 
    const {password} = req.body
    if(password === ''){
        var updates = Object.keys(req.body)
        var allowedUpdates = ['name', 'email', 'age']
        var  isValidOperation = updates.every(update => allowedUpdates.includes(update))
    } else {
        var updates = Object.keys(req.body)
        var allowedUpdates = ['name', 'email', 'password', 'age']
        var isValidOperation = updates.every(update => allowedUpdates.includes(update))
    }
    

     if(!isValidOperation) {
        return res.status(400).send({err: "Invalid request!"})
    }

     try {
        const user = await User.findOne({_id: req.params.userid})

        if(!user){
            return res.status(404).send("Update Request")
        }

        updates.forEach(update => user[update] = req.body[update])
        await user.save()
        res.send(user)

    } catch(e) {

    }
})



app.listen(port, () => {console.log("API Running on port " + port)})