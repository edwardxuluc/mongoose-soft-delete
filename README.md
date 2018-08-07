# Mongoose plugin for soft delete

## Installation

```bash
> npm install mongoose-soft-delete-ex
```

## Usage
```javascript
    var mongoose = require('mongoose');
    
    mongoose.plugin( require('mongoose-soft-delete-ex') );
```

Methods overwriting for exclude deleted documents
- `count`
- `find`
- `findOne`
- `findOneAndUpdate`
- `update`

Methods added for soft delete
- `delete`
- `findByIdAndDelete`
- `findOneAndDelete`

Methods added for restore
- `restore`
