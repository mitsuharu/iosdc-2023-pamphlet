module.exports = {
    title: 'mybook',
    author: '江本光晴 <mthr1982@gmail.com>',
    language: 'ja',
    // theme: '@vivliostyle/theme-techbook',
    theme: 'theme/my-theme-techbook',
    entry: [
      'index.md',
    ],
    entryContext: './manuscripts',
    output: [
      './output/output.pdf',
    ],
    workspaceDir: '.vivliostyle',
    toc: false
    // cover: './cover.png',
    // vfm: {
    //   hardLineBreaks: true,
    //   disableFormatHtml: true,
    // },
  }