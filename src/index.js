const express  = require('express')
const port = require('./config')
const cors = require('cors')
const multer = require('multer')
const sharp = require('sharp')
const User = require('./models/user')
const Task = require('./models/task')
require('./config/mongose')

const app = express()
app.use(cors())
app.use(express.json())

app.post('/users', async (req, res) => { // Register user
    const user = new User(req.body) // create user

    try {
        await user.save() // save user
        res.status(201).send(user)
    } catch (e) {
        res.status(404).send(e.message)
    }
})

app.post('/users/login', async (req, res) => {// Login user
    const {email, password} = req.body // destruct property

    try {
        const user = await User.findByCredentials(email, password) // Function buatan sendiri, di folder models file user.js
        res.status(200).send(user)
    } catch (e) {
        res.status(201).send(e)
    }
})

app.post('/tasks/:userid', async (req, res) => { // Create tasks by user id
    try {
        const user = await User.findById(req.params.userid) // search user by id
        if(!user){ // jika user tidak ditemukan
            throw new Error("Unable to create task")
        }
        const task = new Task({...req.body, owner: user._id}) // membuat task dengan menyisipkan user id di kolom owner
        user.tasks = user.tasks.concat(task._id) // tambahkan id dari task yang dibuat ke dalam field 'tasks' user yg membuat task
        await task.save() // save task
        await user.save() // save user
        res.status(201).send(task)
    } catch (e) {
        res.status(404).send(e)
    }
})

app.get('/tasks/:userid', async (req, res) => { // Get own tasks
    try {
        // find mengirim dalam bentuk array
       
        //https://mongoosejs.com/docs/api.html#query_Query-populate

       const user = await User.find({ _id: req.params.userid })
         .populate({
           path: "tasks",
           options: { sort: { completed: 'asc' } } //sort by completed status
         })
         .exec();
       res.send(user[0].tasks);
    } catch (e) {
        
    }
})

app.delete("/tasks", async (req, res) => { // Delete task
    
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

app.delete("/users/:userId/delete", async (req, res) => { //Delete user & Task
    const { userId } = req.params;
  
    try {
      await User.findOneAndDelete({ _id: userId });
      await Task.deleteMany({ owner: userId });
  
      res.send("success");
    } catch (e) {}
  });

app.delete('/users/:taskid/:userid/', async(req,res)=>{ //delete user
    try {
        const taskUser = await User.findOne({_id:req.params.taskid})
        if(!taskUser){
            return res.status(404).send("User not found")
        } 
        res.status(200).send(taskUser)
    } catch (e) {
        console.log(e);
        
    }
})

app.patch('/tasks/:taskid/:userid', async (req, res) => { // Edit Task
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

const upload = multer({ //upload image
    limits: {
        fileSize: 1000000 // Byte max size
    },
    fileFilter(req, file, cb){                                 
        if(!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            // throw error
            return cb(new Error('Please upload image file (jpg, jpeg, png)'))
        }

        // diterima
        cb(undefined, true)
    }
})

app.post('/users/:userid/avatar', upload.single('avatar'), async (req, res) => { // Post Image
    try {
        const buffer = await sharp(req.file.buffer).resize({ width: 250 }).png().toBuffer()
        const user = await User.findById(req.params.userid)
        
        if(!user) {
            throw new Error("Unable to upload")
        }

        user.avatar = buffer
        await user.save()
        res.send("Upload Success !")
    } catch (e) {
        res.send(e)
    }
})

app.get('/users/:userid/avatar', async (req, res) => { // Get image, source gambar
    try {
        const user = await User.findById(req.params.userid)

        if(!user || !user.avatar){
            throw new Error("Not found")
        }
        res.set('Content-Type', 'image/png')
        res.send(user.avatar)
    } catch (e) {
        res.send(e)
    }
})

app.delete('/avatar/:userid', async(req,res)=>{ //delete image only
    try {
        const user = await User.findOneAndUpdate(
            {
                _id: req.params.userid,
            },
            {$set:{avatar:""}}
        );
        res.status(200).send("avatar has been deleted")
    } catch (e) {
        console.log(e);
    }
})

app.get('/users/:userid', async (req, res)=>{ //Get user by ID
    try {
        const user = await User.findById(req.params.userid)

        if(!user){
            throw new Error("user not found")
        }
        res.send(user)
        console.log(user);
        
    } catch (e) {
        res.send(e)
    }
})

app.patch("/users/:userId", async (req, res) => { //edit profile
    console.log(req.body);
  
    const updates = Object.keys(req.body);
    const allowedUpdates = ["name", "age"];
    const isValidOperation = updates.every(update =>
      allowedUpdates.includes(update)
    );
  
    if (!isValidOperation) {
      return res.status(400).send({ err: "Invalid request!" });
    }
  
    try {
      const user = await User.findOne({
        _id: req.params.userId
      });
  
      if (!user) {
        return res.status(404).send("Update Request");
      }
  
      updates.forEach(update => (user[update] = req.body[update]));
      await user.save();
  
      res.send(user);
    } catch (e) {}
  });

/**Tugas
 * Back End
 * // 1. Update Profile
 * // 2. Update Task field when task deleted (Filtering)
 * // 3. delete avatar
 * // 4. delete user
 * // 5. delete all task when user deleted
 * // 6. Get own task, tambahkan fitur sorting, match, limit
 */

 /**Tugas
  * Front End
  * // 1. Buat front end untuk semua fitur yang sudah dijelaskan plus menjadi tugas back end
  */

app.listen(port, () => console.log("API Running on port " + port))