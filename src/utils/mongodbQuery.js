
const aggregation = async (model, pipeline) => {
    try {
        return await model.aggregate(pipeline, { maxTimeMS: 60000, allowDiskUse: true });
    } catch (error) {
        console.log('Error during aggregation:', error);
        throw error; 
    }
};


const findOne = async (model, query, filter = {}, options = {}) => {
    try {

        return await model.findOne(query, filter, options).lean();
    } catch (error) {
        console.error('Error during findOne:', error);
        throw error; 
    }
};

const findById = async (model, id, options = {}) => {
    try {
        return await model.findById(id, options);
    } catch (error) {
        console.error('Error during findById:', error);
        throw error; 
    }
};


const create = async (model, data) => {
    try {
        return await model.create(data);
    } catch (error) {
        console.error('Error during create:', error);
        throw error; 
    }
};


const find = async (model, query = {}, filter = {}, options = {}) => {
    try {
        return await model.find(query, filter, options);
    } catch (error) {
        console.error('Error during find:', error);
        throw error; 
    }
};

const findByIdAndUpdate = async (model, query = {}, data = {}, options = {}) => {
    try {
        return await model.findByIdAndUpdate(query, data, options);
    } catch (error) {
        console.error('Error during findByIdAndUpdate:', error);
        throw error; 
    }
};


const findOneAndUpdate = async (model, query = {}, data = {}, options = {}) => {
    try {
        return await model.findOneAndUpdate(query, data, options);
    } catch (error) {
        console.error('Error during findOneAndUpdate:', error);
        throw error; 
    }
};

const findByIdAndDelete = async (model, query = {}) => {
    try {
        return await model.findByIdAndDelete(query);
    } catch (error) {
        console.error('Error during findByIdAndUpdate:', error);
        throw error; 
    }
};

exports.dbQuery = {
    aggregation,
    findOne,
    findById,
    create,
    find,
    findByIdAndUpdate,
    findByIdAndDelete,
    findOneAndUpdate
};