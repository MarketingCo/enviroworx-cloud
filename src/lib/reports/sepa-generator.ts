import { DEFAULT_CONFIG } from '../config'

interface Invoice {
  id: string
  cost_gross?: number
  customer_name: string
  ticket_number?: string
}

export function generateSepaXml(invoices: Invoice[], messageId: string) {
  const creationDate = new Date().toISOString()
  let totalAmount = 0
  let transactionCount = 0

  const pmtInfId = `PMT-${messageId}`
  
  const transactionsHtml = invoices.map((inv, index) => {
    const amount = (inv.cost_gross || 0).toFixed(2)
    totalAmount += parseFloat(amount)
    transactionCount++

    return `
      <DrctDbtTxInf>
        <PmtId>
          <InstrId>${inv.id}</InstrId>
          <EndToEndId>${inv.id}</EndToEndId>
        </PmtId>
        <InstdAmt Ccy="GBP">${amount}</InstdAmt>
        <DrctDbtTx>
          <MndtRltdInf>
            <MndtId>MNDT-${inv.customer_name.replace(/[^a-zA-Z0-9]/g, '')}-${index}</MndtId>
            <DtOfSgntr>${creationDate.split('T')[0]}</DtOfSgntr>
          </MndtRltdInf>
        </DrctDbtTx>
        <DbtrAgt>
          <FinInstnId>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </FinInstnId>
        </DbtrAgt>
        <Dbtr>
          <Nm>${inv.customer_name.substring(0, 70)}</Nm>
        </Dbtr>
        <DbtrAcct>
          <Id>
            <Othr>
              <Id>NOTPROVIDED</Id>
            </Othr>
          </Id>
        </DbtrAcct>
        <RmtInf>
          <Ustrd>Invoice ${inv.ticket_number || inv.id}</Ustrd>
        </RmtInf>
      </DrctDbtTxInf>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${messageId}</MsgId>
      <CreDtTm>${creationDate}</CreDtTm>
      <NbOfTxs>${transactionCount}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>Enviroworx</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${pmtInfId}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${transactionCount}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${creationDate.split('T')[0]}</ReqdColltnDt>
      <Cdtr>
        <Nm>Enviroworx</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <Othr>
            <Id>${DEFAULT_CONFIG.accountNumber || '00000000'}</Id>
          </Othr>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <Othr>
            <Id>${DEFAULT_CONFIG.sortCode?.replace(/-/g, '') || '000000'}</Id>
          </Othr>
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>ENVWORKS123</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>
      ${transactionsHtml}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`
}
