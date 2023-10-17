var express = require('express');
var router = express.Router();
const stock_read_log = require('../models/stock_read_log');
const FileSystem = require("fs");

router.use('/export-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();

  FileSystem.writeFile('./stock_read_log.json', JSON.stringify(list), (error) => {
    if (error) throw error;
  });

  console.log('stock_read_log.json exported!');
  res.json({ statusCode: 1, message: 'stock_read_log.json exported!' })
});

router.use('/import-data', async (req, res) => {
  const list = await stock_read_log.aggregate([
    {
      $match: {}
    }
  ]).exec();

  FileSystem.readFile('./stock_read_log.json', async (error, data) => {
    if (error) throw error;

    const list = JSON.parse(data);

    const deletedAll = await stock_read_log.deleteMany({});

    const insertedAll = await stock_read_log.insertMany(list);

    console.log('stock_read_log.json imported!');
    res.json({ statusCode: 1, message: 'stock_read_log.json imported!' })
  });


})

router.use('/edit-repacking-data', async (req, res) => {
  try {
    const { company_id, payload, reject_qr_list, new_qr_list } = req.body;

    if (!company_id || !payload) {
      return res.status(400).json({ statusCode: -1, message: 'company_id and payload are required in the request.' });
    }

    // Find the document with the provided company_id and payload
    const existingDocument = await stock_read_log.findOne({ company_id, payload });

    if (!existingDocument) {
      return res.status(404).json({ statusCode: -1, message: 'Data not found' });
    }

    if (reject_qr_list) {
      // Remove reject_qr_list.payload from the existing document
      reject_qr_list.forEach(async (rejectItem) => {
        const rejectPayload = rejectItem.payload;
        existingDocument.qr_list = existingDocument.qr_list.filter(
          (qr) => qr.payload !== rejectPayload
        );
        // Update the qr document status with the same payload
        await stock_read_log.updateOne(
          { 'payload': rejectPayload },
          { $set: { status: 0, status_qc: 1 } }
        );
      });
    }

    const newQrListData = [];
    if (new_qr_list) {
      // Move qr_list items with matching new_qr_list payloads from other documents
      for (const newItem of new_qr_list) {
        const newPayload = newItem.payload;

        // Find documents where qr_list has the same payload
        const otherDocuments = await stock_read_log.find({ 'qr_list.payload': newPayload });

        // If no documents have the matching qr payload, fetch data from { payload: newPayload } and push it into newQrListData.
        if (otherDocuments.length === 0) {
          const qrData = await stock_read_log.findOne({ payload: newPayload });
          if (qrData) {
            newQrListData.push(qrData);
          } else {
            return res.status(404).json({ statusCode: -1, message: `New QR ${newPayload} Data not found` });
          }
          continue;
        }

        // Iterate through other documents and remove qr_list items with the matching payload
        for (const otherDocument of otherDocuments) {
          const removedQrList = otherDocument.qr_list.filter((qr) => qr.payload === newPayload);
          newQrListData.push(...removedQrList);
          otherDocument.qr_list = otherDocument.qr_list.filter((qr) => qr.payload !== newPayload);
          otherDocument.qty -= removedQrList.length;

          await otherDocument.save();
        }
      }
    }

    // Add removed newQrListData items to existingDocument.qr_list
    existingDocument.qr_list.push(...newQrListData);

    // Update existingDocument.qty with the length of existingDocument.qr_list
    existingDocument.qty = existingDocument.qr_list.length;

    // Save the modified existing document
    await existingDocument.save();

    // Return a success response
    res.json({ statusCode: 1, message: 'Data updated successfully' });
  } catch (error) {
    console.error('Error in /edit-repacking-data endpoint:', error);
    res.status(500).json({ statusCode: -1, message: 'Internal server error' });
  }
});

router.use('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

module.exports = router;
