
'use server';

import { numeroALetras, formatCedulaForPagare } from '@/lib/utils';
import type { CreditDetail, PaymentFrequency } from '@/lib/types';
import { getCredit } from '@/services/credit-service-server';
import { getClient } from '@/services/client-service-server';
import { PDFDocument, rgb, StandardFonts, PDFFont, PageSizes } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { promises as fs } from 'fs';
import path from 'path';
import { getUserByName } from '@/services/user-service-server';

interface DocumentOutput {
    pdfDataUri?: string;
    error?: string;
}

function getNumberOfInstallments(termMonths: number, frequency: PaymentFrequency): number {
    switch (frequency) {
        case 'Diario': return Math.round(termMonths * 20);
        case 'Semanal': return Math.round(termMonths * 4);
        case 'Catorcenal': return Math.round(termMonths * 2);
        case 'Quincenal': return Math.round(termMonths * 2);
        default: return 0;
    }
}


export async function generatePromissoryNotePdf(creditId: string): Promise<DocumentOutput> {
    try {
        const creditData = await getCredit(creditId);
        if (!creditData) return { error: 'Crédito no encontrado.' };
        
        const client = await getClient(creditData.clientId);
        if (!client) return { error: 'Cliente no encontrado.' };

        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        
        let logoImage: any = null;
        let logoDims: any = null;
        
        // Función para cargar logo con fallback a base64
        const loadLogo = async (): Promise<void> => {
            // En producción (serverless), usar logo embebido en base64
            if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
                try {
                    // Logo simple en base64 (pequeño logo CrediNica)
                    const logoBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
                    const logoBytes = Buffer.from(logoBase64, 'base64');
                    
                    // Crear un logo simple programáticamente
                    console.log('🔧 Usando logo programático para producción');
                    return; // Usar el logo alternativo de formas geométricas
                } catch (error) {
                    console.log('❌ Error con logo base64, usando alternativo');
                    return;
                }
            }
            
            // En desarrollo, intentar cargar desde archivos locales
            const possibleLogoPaths = [
                path.join(process.cwd(), 'public', 'CrediNica.png'),
                path.join(process.cwd(), 'public', 'CrediNica-inicial.png'),
                path.resolve('./public/CrediNica.png'),
                path.resolve('./public/CrediNica-inicial.png')
            ];
            
            for (const logoPath of possibleLogoPaths) {
                try {
                    await fs.access(logoPath);
                    const logoBytes = await fs.readFile(logoPath);
                    logoImage = await pdfDoc.embedPng(logoBytes);
                    logoDims = logoImage.scale(0.05);
                    
                    console.log(`✅ Logo cargado exitosamente desde: ${logoPath}`);
                    return;
                } catch (error) {
                    continue;
                }
            }
            
            console.warn('⚠️ Logo no encontrado, usando alternativo');
        };
        
        await loadLogo();

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const page1 = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page1.getSize();
        const margin = 50;
        const contentWidth = width - margin * 2;
        let y = height - margin;

        // --- Header Section ---
        const headerY = y;
        
        // Header con logo o alternativa visual profesional
        if (logoImage && logoDims) {
            // Dibujar logo si está disponible
            page1.drawImage(logoImage, {
                x: margin,
                y: headerY - logoDims.height + 10,
                width: logoDims.width,
                height: logoDims.height,
            });
        } else {
            // Crear logo alternativo profesional
            const logoWidth = 140;
            const logoHeight = 35;
            
            // Dibujar rectángulo principal con gradiente simulado
            page1.drawRectangle({
                x: margin,
                y: headerY - logoHeight,
                width: logoWidth,
                height: logoHeight,
                color: rgb(0.1, 0.3, 0.7), // Azul oscuro
            });
            
            // Dibujar borde superior más claro
            page1.drawRectangle({
                x: margin,
                y: headerY - 3,
                width: logoWidth,
                height: 3,
                color: rgb(0.2, 0.5, 0.9), // Azul más claro
            });
            
            // Dibujar círculo decorativo
            page1.drawCircle({
                x: margin + 15,
                y: headerY - logoHeight / 2,
                size: 8,
                color: rgb(1, 0.8, 0.2), // Dorado
            });
            
            // Dibujar texto "CrediNica" 
            const companyText = "CrediNica";
            const companyTextWidth = fontBold.widthOfTextAtSize(companyText, 13);
            page1.drawText(companyText, {
                x: margin + 30,
                y: headerY - logoHeight / 2 - 4,
                size: 13,
                font: fontBold,
                color: rgb(1, 1, 1), // Blanco
            });
            
            // Dibujar subtítulo
            const subtitleText = "Microfinanzas";
            page1.drawText(subtitleText, {
                x: margin + 30,
                y: headerY - logoHeight / 2 - 16,
                size: 8,
                font: font,
                color: rgb(0.9, 0.9, 0.9), // Gris claro
            });
        }

        const titleText = "PAGARÉ A LA ORDEN";
        const titleWidth = fontBold.widthOfTextAtSize(titleText, 14);
        page1.drawText(titleText, { 
            x: (width - titleWidth) / 2, 
            y: headerY - 5, // Ajustado para alinearse mejor
            font: fontBold, 
            size: 14 
        });
        
        const totalAmount = creditData.totalAmount ?? creditData.amount ?? 0;
        const valorText = `VALOR: C$ ${totalAmount.toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        const valorWidth = fontBold.widthOfTextAtSize(valorText, 11);
        page1.drawText(valorText, { 
            x: width - margin - valorWidth, 
            y: headerY,
            font: fontBold, 
            size: 11 
        });

        y = headerY - logoDims.height - 30; // Increased space from 15 to 30
        // --- End Header Section ---


        const drawRichText = (
            page: any, text: string, initialY: number, fontRegular: PDFFont, fontBold: PDFFont,
            fontSize: number, maxWidth: number, lineHeight: number, isJustified: boolean
        ) => {
            // FIX: Clean up text to remove problematic characters before processing.
            const cleanedText = text.split('\n').join(' ').split('\r').join(' ');
            const parts = cleanedText.split(/(\*\*.*?\*\*)/g).filter(p => p);
            const processedWords: { text: string; width: number; font: PDFFont }[] = [];

            parts.forEach(part => {
                const isBold = part.startsWith('**') && part.endsWith('**');
                const cleanPart = part.replace(/\*\*/g, '');
                const currentFont = isBold ? fontBold : fontRegular;
                cleanPart.split(' ').forEach(word => {
                    if (word) {
                        processedWords.push({ text: word, width: currentFont.widthOfTextAtSize(word, fontSize), font: currentFont });
                    }
                });
            });

            let currentY = initialY;
            let line: typeof processedWords = [];
            let lineWidth = 0;
            const spaceWidth = fontRegular.widthOfTextAtSize(' ', fontSize);

            const drawLine = (currentLine: typeof processedWords, isLastLineOfParagraph: boolean) => {
                let currentX = margin;
                let spacing = spaceWidth;
                if (isJustified && !isLastLineOfParagraph && currentLine.length > 1) {
                    const totalWidthOfWords = currentLine.reduce((sum, word) => sum + word.width, 0);
                    const totalSpacing = maxWidth - totalWidthOfWords;
                    spacing = totalSpacing / (currentLine.length - 1);
                }

                currentLine.forEach(word => {
                    page.drawText(word.text, { x: currentX, y: currentY, font: word.font, size: fontSize, color: rgb(0,0,0) });
                    currentX += word.width + spacing;
                });
                currentY -= lineHeight;
            };
            
            processedWords.forEach((word) => {
                if (lineWidth + word.width + (line.length > 0 ? spaceWidth : 0) > maxWidth) {
                    drawLine(line, false);
                    line = [word];
                    lineWidth = word.width;
                } else {
                    lineWidth += word.width + (line.length > 0 ? spaceWidth : 0);
                    line.push(word);
                }
            });

            if (line.length > 0) drawLine(line, true);
            return currentY;
        };

        const clientName = (client?.name || '____________________').toUpperCase();
        const clientId = client ? formatCedulaForPagare(client.cedula) : '____________________';
        const clientAddress = [
            client?.department,
            client?.municipality,
            client?.neighborhood,
            client?.address
        ].filter(Boolean).join(', ').toUpperCase();

        const totalAmountInWords = numeroALetras(totalAmount).toUpperCase();
        const numberOfInstallments = getNumberOfInstallments(creditData.termMonths, creditData.paymentFrequency);
        const documentDate = creditData.deliveryDate && isValid(parseISO(creditData.deliveryDate)) ? parseISO(creditData.deliveryDate) : new Date();

        const paragraphs = [
            `YO, **${clientName}**, mayor de edad, debidamente identificado con cédula de identidad número **${clientId}** y del domicilio de **${clientAddress || '____________________'}**, en lo sucesivo denominado únicamente como EL DEUDOR.`,
            `Por este PAGARÉ A LA ORDEN pagaré AL SEÑOR **ULBERT ALEJANDRO MARTINEZ LOPEZ**, con cédula de identidad número **001-010179-0012K**, conocido comercialmente como: **CREDINICA** y que en lo sucesivo denominaré como EL ACREEDOR o a su orden en sus oficinas situadas en la ciudad de León, con dirección Villa Casteleon boulevard 1c al este 1c al norte, la cantidad de **C$ ${totalAmount.toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${totalAmountInWords})** que confieso haber recibido a entera satisfacción.`,
            `La forma de pago, será mediante la amortización de pago de **${numberOfInstallments} cuotas** en frecuencias de pagos **${creditData.paymentFrequency.toUpperCase()}**, las cuales comprenden el principal e intereses pactados. Las fechas y montos de pago de cada cuota de amortización se estipularan en el Plan de pago que AL SEÑOR: **ULBERT ALEJANDRO MARTINEZ/CREDINICA** me ha hecho de mi conocimiento. Para los efectos del presente pagaré a la orden renuncio al domicilio sin costo legal de la República de Nicaragua, sujeto a jurisdicción y tribunales de la ciudad de León. Hago constar que la firma expuesta en el presente pagaré es la que utilizo en todos y para todos los fines de ley.`,
            `El plazo del presente pagaré a la orden se dará como finalizado anticipadamente sin excepción, a elección DEL SEÑOR: **ULBERT ALEJANDRO MARTINEZ/CREDINICA**, si se entablare por otra persona acción judicial en mi contra o de mis fiadores o también si incumpliere con el pago de dos de las cuotas de pago arriba señaladas, o bien si dejase de cumplir con cualquier otra obligación contraída con EL SEÑOR: **ULBERT ALEJANDRO MARTINEZ/CREDINICA**. En caso de que faltare el pago de una sola de las cuotas en la fecha señalada o el solo hecho del incumplimiento sin necesidad de requerimiento judicial, quedando en libertad EL ACREEDOR de solicitarme de forma completa e inmediata el pago por medio de la correspondiente ejecución. En virtud de lo anterior, me someto a los juzgados civiles del departamento de León y acepto los gastos de cobranza judicial y extrajudicial, así como también los intereses legales de ser necesario.`,
            `Para los efectos legales renuncio al fuero tributo y de la fuerza mayor, cuyos riesgos acepto, por imprevistos o inesperados que estos sean, o de igual forma, autorizo AL ACREEDOR en caso de incumplimiento parcial o total del presente pagaré a retirar los bienes puestos en garantía, de los cuales soy custodio, y autorizo al ACREEDOR a que se adjudique dichos bienes en activo que yo sea representado por el mismo y a favor de él en caso de ejecución por el incumplimiento y lo acepto en todo el sentido.`
        ];
        
        paragraphs.forEach(p => {
            y = drawRichText(page1, p, y, font, fontBold, 11, contentWidth, 14, true);
            y -= 8; 
        });
        
        y -= 10;
        const fechaCiudad = `${(client?.municipality || 'León').toUpperCase()}, ${format(documentDate, "dd 'de' MMMM 'del' yyyy", { locale: es })}.`;
        page1.drawText(fechaCiudad, { x: margin, y, font, size: 11 });
        y -= 80;

        const signatureLineText = "___________________________";
        const signatureLineWidth = font.widthOfTextAtSize(signatureLineText, 12);
        
        page1.drawText(signatureLineText, { x: margin, y: y, font: font, size: 12 });
        page1.drawText(signatureLineText, { x: width - margin - signatureLineWidth, y: y, font: font, size: 12 });
        y -= 20;

        const clientNameText = (client?.name || 'FIRMA CLIENTE').toUpperCase();
        const clientNameWidth = fontBold.widthOfTextAtSize(clientNameText, 10);
        page1.drawText(clientNameText, { x: margin + (signatureLineWidth - clientNameWidth) / 2, y: y, font: fontBold, size: 10 });

        const creditorNameText = "ULBERT ALEJANDRO MARTÍNEZ";
        const creditorNameWidth = fontBold.widthOfTextAtSize(creditorNameText, 10);
        page1.drawText(creditorNameText, { x: (width - margin - signatureLineWidth) + (signatureLineWidth - creditorNameWidth) / 2, y: y, font: fontBold, size: 10 });
        
        if (creditData.guarantors && creditData.guarantors.length > 0) {
            const fiador = creditData.guarantors[0];
            const page2 = pdfDoc.addPage(PageSizes.Letter);
            let y2 = height - 50;

            const titleFiador = "DEUDOR SOLIDARIO";
            page2.drawText(titleFiador, { x: width / 2 - fontBold.widthOfTextAtSize(titleFiador, 14) / 2, y: y2, font: fontBold, size: 14 });
            y2 -= 40;
            
            const fiadorParagraphs = [
                `Yo, **${fiador.name.toUpperCase()}**, mayor de edad, identificado con cédula de identidad número **${formatCedulaForPagare(fiador.cedula)}** del domicilio de **${fiador.address.toUpperCase()}** en mi propio e interés me constituyo como DEUDOR SOLIDARIO Y FIADOR de **${(client?.name || '').toUpperCase()}**, para con EL ACREEDOR: **ULBERT ALEJANDRO MARTÍNEZ LÓPEZ**, conocido como **CREDINICA**, a fin de garantizar el pago total y extensivo de la cantidad de **C$ ${totalAmount.toLocaleString('es-NI', {minimumFractionDigits: 2, maximumFractionDigits: 2})}** estipulado en el pagaré a la orden que antecede. Acepto hacer propia dicha obligación.`,
                `En fe de lo anterior firmo en la ciudad de **${(client?.municipality || 'León').toUpperCase()}**, el día **${format(documentDate, "dd 'de' MMMM 'del' yyyy", { locale: es })}**.`
            ];
            
            fiadorParagraphs.forEach(p => {
                y2 = drawRichText(page2, p, y2, font, fontBold, 11, contentWidth, 14, true);
                y2 -= 8;
            });

            y2 -= 70;
            
            const fiadorNameText = fiador.name.toUpperCase();
            const fiadorNameWidth = fontBold.widthOfTextAtSize(fiadorNameText, 10);
            page2.drawText(signatureLineText, { x: margin, y: y2, font: font, size: 12 });
            y2 -= 20;
            page2.drawText(fiadorNameText, { x: margin + (signatureLineWidth - fiadorNameWidth) / 2, y: y2, font: fontBold, size: 10 });
        }
        
        const pdfBytes = await pdfDoc.save();
        const pdfDataUri = `data:application/pdf;base64,${Buffer.from(pdfBytes).toString('base64')}`;
        
        return { pdfDataUri };

    } catch (e: any) {
        console.error("PDF Generation Error (Promissory Note):", e);
        return { error: `Error al generar el pagaré: ${e.message}` };
    }
}

    