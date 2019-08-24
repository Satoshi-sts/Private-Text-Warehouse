//初期表示時、ストレージにあるデータをページにリスト表示
function init(){
  chrome.storage.local.get(null, function(objects){
    const storageKeys = Object.keys(objects);
      storageKeys.forEach(function(key){
        addElement(objects[key]);
      });
      //上記の、画面初期表示時にDOMに要素を追加する処理が終わったら、クリックイベントを追加する。
      addClickEventToList();
  });
}

//初期表示時とデータ登録時に呼ばれる処理で、DOMに要素を追加する処理。
function addElement(storageObject, type){
  const a = document.createElement("a");
  const span = document.createElement("span");
  const li = document.createElement("li");
  if(storageObject.dataGroup == 'text'){
    span.setAttribute("data-group", storageObject.dataGroup);
    span.innerHTML = storageObject.value;
    li.append(span);
  }else if(storageObject.dataGroup == 'url'){
    a.setAttribute("href", storageObject.value);
    a.setAttribute("data-group", storageObject.dataGroup)
    a.textContent = storageObject.label;
    //以下のクリックイベントを付与し、以下の書き方しないと、上手くURL押しても遷移しない
    a.addEventListener("click", function(){
      chrome.tabs.create({url: a.href});
    });
    li.append(a);
  }
  //”削除”要素を追加
  $('#storage_list').append(li);


}

//引数の値をクリップボードにコピーする
function copyTextToClipboard(textVal){
  // テキストエリアを用意する
  var copyFrom = document.createElement("textarea");
  // テキストエリアへ値をセット
  copyFrom.textContent = textVal;

  // bodyタグの要素を取得
  var bodyElm = document.getElementsByTagName("body")[0];
  // 子要素にテキストエリアを配置
  bodyElm.appendChild(copyFrom);

  // テキストエリアの値を選択
  copyFrom.select();
  // コピーコマンド発行
  var retVal = document.execCommand('copy');
  // 追加テキストエリアを削除
  bodyElm.removeChild(copyFrom);
}

//リストの要素にクリックイベントを付与する。初期表示時と削除モードOFF時に付与され、要素押下で削除
function addClickEventToList(){
  //storage_listの子要素 li の子要素は、対象がテキストならspan、URLならaと固定されていないため、jQueryのchildren()で子要素を全て取得
  $('#storage_list').children('li').children().off("click");
  $('#storage_list').children('li').children().on("click", function(e){
    const targetGroup = e.target.dataset.group;
    const targetText = e.target.childNodes[0].textContent;
    if(targetGroup == 'text'){
      //クリップボードへコピーする関数
      copyTextToClipboard(targetText);
      e.target.childNodes[0].textContent = "Copied!";
      setTimeout(function(){
        e.target.childNodes[0].textContent = targetText;
      }, 1500);
    }else if(targetGroup == 'url'){
      //URLはクリックすると新規タブで開く
      window.open(targetText, "newtab");
    }
  });
}

//リストの要素にクリックイベントを付与する。削除モードがONの時に付与され、要素押下で削除
function addRemoveClickEventToList(){
  $('#storage_list').children('li').children().off("click");
  $('#storage_list').children('li').children().on("click", function(e){
    const targetValue = e.target.childNodes[0].textContent;
    const targetGroup = e.target.dataset.group;
    const targetKey = targetValue + targetGroup;
    if(window.confirm(targetValue + " を削除します。OK?")){
      chrome.storage.local.remove(targetKey, function(){
        e.target.parentNode.remove();
      });
    };
  })
}

//保存ボタン押下時に呼ばれる処理。ストレージに値を保存し、保存したデータをDOMに追加
function saveTextToStorage(text, dataGroup){
  //ストレージに保存するキーとして使用する。TextとURLを最後尾に付与する事で、テキストとして保存した時とURLで保存した時とでキーが被らない。
  const key = text + dataGroup;
  //登録可否チェック。Textとして、もしくはURLとして既に登録されていたら、アーリーリターン。
  chrome.storage.local.get(key, function(item){
    if(Object.values(item).length > 0){
      if(Object.values(item)[0].dataGroup == 'text'){
        alert(`[${text}] はテキストとして既に登録されているため、テキストとして追加登録は出来ません。`);
      }else if(Object.values(item)[0].dataGroup == 'url'){
        alert(`[${text}]は URLとして既に登録されているため、URLとして追加登録は出来ません。`);
      }
      return;
    }
    //登録可能時、以下を実行
    else{
      //ラベルの初期値は、テキストボックスの入力値
      let label = text;
      //データ登録時、URLとして登録されようとしたら、ラベル（表示名）を別に命名するか確認
      if(dataGroup == 'url'){
        if(window.confirm("表示名を別途命名しますか？")){
          label = window.prompt("表示名を入力してください。", "");
        }
      }

      //データの登録
      const obj = {
        [key]: {
          "dataGroup": dataGroup,
          "value": text,
          "label": label
        }
      }
      chrome.storage.local.set(obj, function(){
        chrome.storage.local.get(key, function(items){
          const targetVal = items[key];
          //クリックイベントを削除
          $('#storage_list').children('li').off('click');
          addElement(targetVal, "add");
          //DOMに新規で追加した要素にクリックイベントを登録するために、イベントの再登録
          addClickEventToList();
        });
      });
    }
  });
}

//リストを削除
function listAllRemove(){
  const target = document.getElementById('storage_list');
  while (target.firstChild) {
    target.removeChild(target.firstChild);
  }
}


function main(){

//チェックボックス押下時の処理。1つのみチェック付けれるようにする。
  $('.checkbox').on("click", function(){
    $('.checkbox').prop('checked', false);
    $(this).prop('checked', true);
  });

//検索ボタン押下時の処理。ボタン押されたら、ストレージから値取ってきて、検索テキストと比較する
  $('.searchBox').on("keyup",function(){
    const searchText = $('.searchBox').val();
    const resultVal = [];

    //検索ボックスが空かどうか
    if(searchText){
      // リストを削除
      listAllRemove();

      //リスト削除後、検索結果のリストを描画
      chrome.storage.local.get(null, function(objects){
        const storageVal = Object.values(objects);
        storageVal.forEach(function(val){
          if(val.value.indexOf(searchText) != -1){
            //検索結果と随時渡して画面描画
            addElement(val);
          }
          addClickEventToList();
        });
      });
    }else{
      //リストを削除
      listAllRemove();
      //ストレージにある全オブジェクトのリストを表示
      init();
    };

  });

//保存ボタン押下時の処理。
  $('#save').on("click", function(){
    const text = $('#text_box').val();
    //チェックされてるチェックボックスの値を全て取得。今回は2つしかチェックボックスが無いので、for文とかで回す必要なし
    const dataGroup = $('input:checked').val();
    saveTextToStorage(text, dataGroup);
  });

  //削除モードボタン押下時
  $('#removeModeBtn').on("click", function(e){
    let str = e.target.value;
    if(str == "RemoveMode ON"){
      //クリックイベントを削除する事で、要素クリックしてもコピーされない。
      addRemoveClickEventToList();
      $('body').css("background", "rgba(192, 192, 192, 0.7)");
      str = "RemoveMode OFF";
    }else{
      //クリックイベントを再度付与
      addClickEventToList();
      $('body').css("background", "");
      str = "RemoveMode ON";
    }
    e.target.value = str;

  });
}

//画面読み込み時、全てのDOMが読まれた後に、JavaScriptの処理を開始
document.addEventListener("DOMContentLoaded", function(){
  init();
  main();
});
