const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const moment = require('moment-timezone');

exports.generatePDF = async (event) => {
  const body = JSON.parse(event.body);
  const { userName, flightDetails, receiptId, quantity, totalPrice } = body;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const margin = 50;

  // Estilos
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const titleFontSize = 24;
  const subtitleFontSize = 16;
  const contentFontSize = 12;
  const smallFontSize = 10;

  // Cargar y mostrar la imagen de la aerolínea
  const airlineLogoUrl = flightDetails.airline_logo;
  const logoImageBytes = await fetch(airlineLogoUrl).then(res => res.arrayBuffer());
  const logoImage = await pdfDoc.embedPng(logoImageBytes);
  const logoWidth = 100; // Ancho de la imagen
  const logoHeight = 100; // Altura de la imagen
  const logoX = (width - logoWidth) / 2;
  const logoY = height - margin - logoHeight;
  page.drawImage(logoImage, {
    x: logoX,
    y: logoY,
    width: logoWidth,
    height: logoHeight
  });

  let detailY = logoY - 50; // Espacio entre la imagen y el texto

  // Título
  const title = 'FlightsApp';
  const titleWidth = font.widthOfTextAtSize(title, titleFontSize);
  const titleX = (width - titleWidth) / 2;
  page.drawText(title, {
    x: titleX,
    y: detailY,
    size: titleFontSize,
    font: font,
    color: rgb(0.05, 0.4, 0.65)
  });

  detailY -= 30; // Espacio después del título

  // Subtítulo
  const subtitle = 'Grupo 9';
  const subtitleWidth = boldFont.widthOfTextAtSize(subtitle, subtitleFontSize);
  const subtitleX = (width - subtitleWidth) / 2;
  page.drawText(subtitle, {
    x: subtitleX,
    y: detailY,
    size: subtitleFontSize,
    font: font,
    color: rgb(0.5, 0.5, 0.5)
  });

  detailY -= 50; // Espacio después del subtítulo para la línea divisoria

  // Línea divisoria después del subtítulo
  page.drawLine({
    start: { x: margin, y: detailY },
    end: { x: width - margin, y: detailY },
    color: rgb(0.65, 0.65, 0.65),
    thickness: 1
  });

  detailY -= 30; // Espacio después de la línea divisoria

  // Número de boleta y detalles
  const receiptText = `Boleta Electrónica Nº ${receiptId}`;
  const receiptWidth = boldFont.widthOfTextAtSize(receiptText, subtitleFontSize);
  const receiptX = (width - receiptWidth) / 2;
  page.drawText(receiptText, {
    x: receiptX,
    y: detailY,
    size: subtitleFontSize,
    font: boldFont
  });

  detailY -= 20; // Espacio después del número de boleta

  page.drawText(`Cliente: ${userName}`, {
    x: margin,
    y: detailY,
    size: contentFontSize,
    font: font
  });

  detailY -= 20; // Espacio después de los datos del cliente

  // Fecha
  const formattedDate = moment().tz('America/Santiago').format('DD [de] MMMM [de] YYYY, HH:mm');
  page.drawText(`Fecha: ${formattedDate}`, {
    x: margin,
    y: detailY,
    size: contentFontSize,
    font: font
  });

  detailY -= 30;

  // Línea divisoria después del subtítulo
  page.drawLine({
    start: { x: margin, y: detailY },
    end: { x: width - margin, y: detailY },
    color: rgb(0.65, 0.65, 0.65),
    thickness: 1
  });

  detailY -= 30; // Espacio para detalles del vuelo

  // Convertir tiempos de vuelo a hora chilena
  const departureTimeChilean = moment(flightDetails.departure_airport_time).tz('America/Santiago').format('DD/MM/YYYY HH:mm');
  const arrivalTimeChilean = moment(flightDetails.arrival_airport_time).tz('America/Santiago').format('DD/MM/YYYY HH:mm');

  // Detalles del vuelo
  const flightDetailsTexts = [
    `Vuelo Nº ${flightDetails.flightId}`,
    `Aerolínea: ${flightDetails.airline}`,
    `Salida: ${departureTimeChilean}`,
    `Llegada: ${arrivalTimeChilean}`,
    `Sigla de Salida: ${flightDetails.departure_airport_id}`,
    `Aeropuerto de Salida: ${flightDetails.departure_airport_name}`,
    `Sigla de Destino: ${flightDetails.arrival_airport_id}`,
    `Aeropuerto de Destino: ${flightDetails.arrival_airport_name}`,
    `Cantidad de Pasajes: ${quantity}`,
    `Precio por Pasaje: $${flightDetails.price}`
  ];

  flightDetailsTexts.forEach(text => {
    page.drawText(text, {
      x: margin,
      y: detailY,
      size: contentFontSize,
      font: font
    });
    detailY -= 15; // Ajusta el espaciamiento según sea necesario
  });

  detailY -= 15; // Espacio después de los detalles del vuelo

  // Línea divisoria después del subtítulo
  page.drawLine({
    start: { x: margin, y: detailY },
    end: { x: width - margin, y: detailY },
    color: rgb(0.65, 0.65, 0.65),
    thickness: 1
  });

  detailY -= 20; // Espacio después de la línea divisoria

  // Total
  page.drawText(`Total: $${totalPrice}`, {
    x: margin,
    y: detailY,
    size: contentFontSize,
    font: boldFont
  });

  // Guardar PDF
  const pdfBytes = await pdfDoc.save();
  const userNameForFile = userName.replace(/[^a-zA-Z0-9]/g, ''); // Elimina todo lo que no sea alfanumérico
  const fileName = `boleta-${userNameForFile}-${Date.now()}.pdf`;  
  const params = {
    Bucket: 'boletas-flightsapp-grupo9',
    Key: fileName,
    Body: pdfBytes,
    ContentType: 'application/pdf'
  };

  await s3.upload(params).promise();

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'PDF generado', url: `https://${params.Bucket}.s3.amazonaws.com/${fileName}` }),
  };
};
